/*global _, Activity, Class, console, ContactsLib, Date, DBModels, Future, include, mapReduce, MojoDB, Person, PalmCall*/
/*
 * Copyright 2010 Palm, Inc.  All rights reserved.
 */

// this.controller has the following properties: service,config,message,args,future,activity,assistant,_timeout,_timer		
// example this.controller.args {"$activity":{"activityId":1,"trigger":{"fired":true,"returnValue":true}}}
var NewMessagesCommandAssistant = Class.create({
	run: function(future) {
		this.revision = this.controller.args.revision || 0;
		console.log("Starting NewMessagesCommandAssistant rev=" + this.revision);
		
		// Query for messages not associated with a conversations
		future.now(this, function(future) {
			future.nest(DBModels.Messages.findUnthreaded(this.revision));
		});

		/*
			for each Message {
				get the list of addresses based on folder type
				for each address {
					deal with the message & address 
				}
			}
		*/
		// Each message can have multiple addresses so it can be associated with multiple conversations.
		future.then(this, function(future) {
			var messageList = future.result ? future.result.results : [];
			console.info("NewMessagesCommandAssistant: number of unassociated mesages: " +messageList.length);
			if (messageList !== undefined && messageList.length > 0) {
				future.nest(this.handleMessage(messageList[0]));
			} else {
				future.result = true;
			}
		});
	},
	
	// Complete the activity with restart
	complete: function(activity) {
		console.info("NewMessagesCommandAssistant:complete activity " + activity._activityId + ", rev="+this.revision);
		var restartParams = {
			activityId: activity._activityId,
			restart: true,
			trigger: {
				method: "palm://com.palm.db/watch",
				key: "fired",
				params: {
					query: {
						from: "com.palm.message:1",
						where: [
							{prop: "conversations", op: "=", val: null},
							{prop: "flags.visible", op: "=", val: true},
							{prop: "_rev", op: ">", val: this.revision}
						]
					}
				}
			},
			callback: {
				method: "palm://com.palm.messaging.chatthreader/newMessages",
				params: { revision: this.revision }
			}
		};
		return PalmCall.call(activity._service, "complete", restartParams);
	},
	
	// The message can have multiple addresses associated with it, so use mapReduce to handle each address
	handleMessage: function(message) {
		//console.info(handleMessage " + JSON.stringify(message));

		if (message._rev > this.revision) {
			this.revision = message._rev;
		}

		var addressList = Messaging.Message.getAddressesForThreading(message);
		if (addressList.length > 0) {
			//console.info("NewMessagesCommandAssistant: mapReduce on " + JSON.stringify(message));
			var mapFunc = _.bind(this.handleMessageAndAddress, this, message);
			return mapReduce({map:mapFunc}, addressList);
		} else {
			// The message should always have recips. If doesn't, put it in a 
			// default chatthread since it must be assigned to one.
			console.error("NewMessagesCommandAssistant: ERROR: message is missing recipient " + JSON.stringify(message));
			var future = DBModels.Conversations.findOrCreate(undefined, message, {});
			future.then(function(future) {
				var conversation = future.result;
				future.nest(DBModels.Messages.addConversation(message, conversation));
			});
			return future;
		}
	},

	/*
		contacts reverse lookup to get the Person
		if no Person {
			lookup "orphan" conversation with given address
			if conversation doesn't exist, create it.
		} else {
			lookup conversation associated with person ID
			if conversation doesn't exist, create it.
		}
		add conversation ID to message
	 */
	handleMessageAndAddress: function(message, address) {
		var outerFuture = new Future();
		//console.info("handleMessageAndAddress looking for " +JSON.stringify(address));			
		address = this.convertAddressToObject(address);
		
		// Do contacts reverse lookup
		outerFuture.now(this, function(future) {
			console.info("handleMessageAndAddress: nesting contactReverseLookup ");
			future.nest(this.contactReverseLookup(address, message));
		});

		// Lookup or create the conversation
		outerFuture.then(this, function(future) {
			//console.info("handleMessageAndAddress: result from contactReverseLookup " + JSON.stringify(future.result));
			var person  = this.getPerson(future);
			future.nest(DBModels.Conversations.findOrCreate(person, message, address));
		});
		
		// Associate the message with the conversation 
		outerFuture.then(function(future) {
			var conversation = future.result;
			if (conversation) {
				var id = conversation && conversation._id;
				console.info("handleMessageAndAddress: got conversation id=" + id);
				future.nest(DBModels.Messages.addConversation(message, conversation));
			} else {
				future.result = true;
			}
		});

		return outerFuture;
	},

	contactReverseLookup: function(params, message) {
		//console.info("contactReverseLookup " +JSON.stringify(params)+ "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
		var address = params.addr;
		var future;

		if (address === undefined) {
			console.error("contactReverseLookup address is undefined");
			future = new Future();
			future.result = undefined;
		// GroupChat's don't have a person so skip the reverse lookup
		} else if (message.groupChatName) {
			future = new Future();
			future.result = undefined;
		// Assume it is a phone number if the dbkind is com.palm.smsmessage or com.palm.mmsmessage
		// TODO: verify this works for phone services that have usernames instead of numbers
		} else if (NewMessagesCommandAssistant.SmsOrMmsRegex.test(message._kind)) {
			// For phone numbers, just look up the first person with that phone number
			var findByPhoneParams = {
				personType:ContactsLib.PersonType.RAWOBJECT,
				returnAllMatches: false
			};
			future = Person.findByPhone(address, findByPhoneParams);
		} else {
			var findByImParams = {
				personType:ContactsLib.PersonType.RAWOBJECT,
				returnAllMatches: true
			};
			future = Person.findByIM(address, message.serviceName, findByImParams);
			future.then(this, function(future) {
				var results = future.result || [];
				console.info("contactReverseLookup: found "+results.length+" IM persons for address="+address+", serviceName="+message.serviceName);

				if (results.length > 1) {
					// Need to figure out which person is the right one by finding which account the 
					// message was sent to.				
					var myUsername = this.getUsername(message); 
					
					// If my user name isn't set, then just assume the first person in the list
					if (myUsername === undefined) {
						console.error("contactReverseLookup: message was missing my username so choosing first person");
						future.result = results[0];
					} else {
						future.nest(this.findPersonForAccount(myUsername, message.serviceName, results));
					}
				} else {
					//result is empty or just a single person.
					future.result = future.result;
				}
			});
		}
		return future;
	},
	
	findPersonForAccount: function(myUsername, serviceName, personList) {
		myUsername = Messaging.Utils.normalizeAddress(myUsername, serviceName);
		
		var mapFunc = _.bind(this.getAccountFromUsername, this, myUsername, serviceName);
		
		// 1. Get the contacts associated with each person
		// 2. Get the account associated with each contact
		// 3. Compare the account.username to message.to.addr
		var mapFuture = mapReduce({map:mapFunc}, personList);
		mapFuture.then(this, function(mapFuture) {
			if (mapFuture.result && mapFuture.result.length > 0) {
				mapFuture.result = mapFuture.result;
			} else {
				mapFuture.result = personList;
			}
		});
		
		return mapFuture;
	},
	
	getAccountFromUsername: function(myUsername, serviceName, person) {
		// 1. Get the contacts associated with each person
		var future = MojoDB.get(person.contactIds);
		future.then(this, function(future) {
			var contacts = future.result.results || [];
			var accountIds = this.getAccountIds(contacts, serviceName);
			
			// 2. Get the account associated with each contact
			future.nest(MojoDB.get(accountIds));
		});
		
		// 3. Compare the account.username to message.to.addr
		future.then(this, function(future) {
			var accounts = future.result.results || [];
			var matchedPersons = [];
			//console.log("*****findPersonForAccount: "+accounts.length+" accounts found");
			accounts.forEach(function(account) {
				//console.log("findPersonForAccount: testing account.username ("+account.username+") == myUsername ("+myUsername+")");
				if (myUsername === Messaging.Utils.normalizeAddress(account.username, serviceName)) {
					matchedPersons.push(person);
				}
			});
			future.result = matchedPersons;
		});	
		return future;
	},
	
	/***********************************
	 * Functions below are unit tested *
	 ***********************************/	
	convertAddressToObject: function (address) {
		if (typeof address === "string") {
			console.error("convertAddressToObject address is a stconvertAddressToObjectring. Converting to object");
			address = {addr: address };
		} else if (!address) {
			console.error("convertAddressToObject address object is undefined, setting to 'No Recipients'");
			address = {addr: Messaging.Utils.kMissingAddress };
		} else if (address.addr === undefined) {
			console.error("convertAddressToObject address.addr is undefined, setting to 'No Recipients'");
			address.addr = Messaging.Utils.kMissingAddress;
		}
		return address;
	},
	
	getPerson: function(future) {
		var person = undefined;
		if (future.result) {
			var results = future.result;
			if (future.result.length === 1) {
				person = future.result[0];
			} else if (future.result.length > 1) {
				//TODO: need to look up which person to use
				person = future.result[0];
			} else {
				person = future.result;
			}
		}
		return person;
	},
	
	getUsername: function(message) {
		var username = undefined; 
		if (message.folder === "inbox") {
			if (message.to && message.to.length > 0) {
				username = message.to[0]; // assume the first since it was sent to me so I should be the only recipient
			}
		} else if (message.from) {
			username = message.from;
		}
		return username;
	},
	
	getAccountIds: function(contacts, serviceName) {
		var accountIds = [];
		contacts.forEach(function(contact) {
			// An IM buddy contact only ever has one im address.
			if (contact.ims && contact.ims.length === 1 && contact.ims[0].type === serviceName) {
				console.info("findPersonForAccount: adding account "+contact.accountId);
				accountIds.push(contact.accountId);
			}
		});
		return accountIds;
	}
});

NewMessagesCommandAssistant.SmsOrMmsRegex = /^com\.palm\.(sms|mms)message/;
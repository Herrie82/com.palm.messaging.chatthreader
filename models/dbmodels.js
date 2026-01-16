/*global console, Utils, MojoDB, TempDB, Future, ContactsLib*/
/*jslint white: false, onevar: false, nomen:false, plusplus: false*/

/*
 * Copyright 2010 Palm, Inc.  All rights reserved.
 */

var DBModels = {};

/*********************************************************************************************
	Individual chat messages - base for IM, SMS, and MMS 
*********************************************************************************************/
DBModels.Messages = {
	id: "com.palm.message:1",

	getWatchQuery: function() {
		return {
			query: {
				from: DBModels.Messages.id,
				where: [
					{ prop: "conversations", op: "=", val: null },
					{ prop: "flags.visible", op: "=", val: true }
				]
			}
		};
	},

	// Query for messages that have a null conversation
	findUnthreaded: function(revision) {
		console.info("DBModels.Messages.findUnthreaded: watching for new messages");
		var query = {
			from: DBModels.Messages.id,
			where: [
				{ prop: "conversations", op: "=", val: null },
				{ prop: "flags.visible", op: "=", val: true },
				{ prop: "_rev", op: ">", val: revision}
			]
		};
		return MojoDB.find(query);
	},
	
	/**
	 * addConversation 
	 * future.result = -1 if something went wrong
	 */
	addConversation: function(message, conversation, noNotification) {
		console.info("DBModels.Messages.addConversation: start");
//		console.info("message="+JSON.stringify(message));
		var future = new Future();
		// "conversations" could be null or undefined
		if (!message.conversations) {
			message.conversations = [];
		}
		
		var id = conversation._id;
		if (id === undefined) {
			console.error("DBModels.Messages.addConversation: id is undefined");
			future.result = -1;
		} else {
			var index = message.conversations.indexOf(id);
			if (index !== -1) {
				// Already exists
				console.info("DBModels.Messages.addConversation: conversation '"+id+"' already exists at index "+index);
				future.result = 1; // simulate a successful merge 
			} else {
				message.conversations.push(id);
				console.info("DBModels.Messages.addConversation: add conversation id "+id+" now "+JSON.stringify(message.conversations));
				future = MojoDB.merge([
					{
						_id: message._id,
						conversations: message.conversations,
						flags: {noNotification: noNotification}
					}
				]);
			}
		}

		return future;
	},
	
	resetPendingGroupChatMessages: function() {
		console.info("DBModels.Messages.resetPendingGroupChatMessages");
		var mergeObject = {
			props: {
				conversations: null,
				flags : {noNotification: false}
			},
			query: {
				from: DBModels.Messages.id,
				where: [{ prop: "conversations", op: "=", val: DBModels.kMessagePendingGroupChatId }]
			}
		};
		return MojoDB.execute("merge", mergeObject);
	},
	
	// Query for messages that have been deleted. Only select retrieve _rev and conversation.
	findDeleted: function(revision) {
		console.info("DBModels.Messages.findDeleted: query for deleted messages");
		var query = {
			from: DBModels.Messages.id,
			select: ["_rev", "conversations"],
			where: [
				{prop: "_del", op: "=", val: true},
				{prop: "_rev", op: ">", val: revision}
			],
			orderBy: "_rev",
		};
		return MojoDB.find(query);
	},

	// Query for inbox and outbox messages for a given conversation
	findMessagesForThread: function(conversation) {
		console.info("DBModels.Messages.findMessagesForThread: query messages for thread: "+conversation);
		var query = {
			from: DBModels.Messages.id,
			select: ["conversations", "localTimestamp", "messageText", "folder"],
			where: [
				{prop: "conversations", op: "=", val: conversation},
				{prop: "flags.visible", op: "=", val: true}
			],
			orderBy: "localTimestamp",
			desc: true,
			limit: 50		
		};
		return MojoDB.find(query);
	}

};

/*********************************************************************************************
	Chat threads 
*********************************************************************************************/
DBModels.Conversations = {
	id: "com.palm.chatthread:1",
	
	/*
	 * required properties:
	 * replyAddress, replyService, and summary
	 * either personId or groupChatId can be specified
	 */
	createNew: function(replyAddress, replyService, summary, flags, optionalParams) {
		var future;
		if (optionalParams && (optionalParams.personId || optionalParams.groupChatId)) {
			future = DBModels.Conversations.lookupDisplayName(optionalParams);
		} else {
			future = new Future();
			future.result = replyAddress;
		}
		
		future.then(this, function(future) {
			var displayName = undefined;
			if (future.result) {
				displayName = future.result;
			// Leave the displayname empty for group chats that don't have a topic set
			} else if (!optionalParams || !optionalParams.groupChatId) {
				displayName = replyAddress;
			}
			
			var conversation = {
				_kind: DBModels.Conversations.id,
				timestamp: Date.now(),
				summary: summary || "",
				flags: flags,
				displayName: displayName,
				replyAddress: replyAddress,
				normalizedAddress: Messaging.Utils.normalizeAddress(replyAddress, replyService),
				replyService: replyService
			};
			future.nest(MojoDB.put([conversation]));
		});
		return future;
	},

	/*
	 * Adds the displayName property to the chatThread by looking it up from the appropriate source
	 */
	lookupDisplayName: function(chatThread) {
		//console.log("*****lookupDisplayName ++++++");
		var future;
		var displayName = false;
		if (chatThread.groupChatId) {
			future = MojoDB.get([chatThread.groupChatId]);
			future.then(this, function(future) {
				if (future.result.results && future.result.results.length > 0) {
					var groupChat = future.result.results[0];
					displayName = groupChat.displayName;
					// console.log("lookupDisplayName got groupchat name: "+displayName);
				}
				future.result = displayName;
			});
		} else if (chatThread.personId) {
			future = MojoDB.get([chatThread.personId]);
			future.then(this, function(future) {
				if (future.result.results && future.result.results.length > 0) {
					displayName = ContactsLib.Person.generateDisplayNameFromRawPerson(future.result.results[0]);
					// console.log("lookupDisplayName got person name: "+displayName);
				}
				future.result = displayName;
			});
		} else {
			future = new Future();
			future.result = Messaging.Utils.formatAddress(chatThread.replyAddress, chatThread.replyService);
		}
		
		future.then(this, function(future) {
			if (future.result && future.result.length > 0) {
				future.result = future.result;
			} else {
				if(chatThread.displayName){
					future.result = chatThread.displayName;
				}
				else if (chatThread.replyAddress) {
					//console.log("lookupDisplayName got replyAddress: "+chatThread.replyAddress);
					future.result = chatThread.replyAddress;
				} else {
					console.warn("lookupDisplayName: surprisingly I couldn't find any displayable name");
					future.result = "";
				}
			}
		});
		
		return future;
	},
	
	/**
	 * findOrCreate 
	 * future.result will be an object with _id of the conversation or undefined if something went wrong
	 */
	findOrCreate: function(person, message, address) {
		// targetConversation references a conversation object that will be the eventual future.result value.
		// It will be the result of a db.find() or pieced together and _id added as part of a db.put()
		var conversationList, targetConversation = undefined;
		if (address.addr !== undefined) {
			// TODO: This is a HACK. The service should clean up the address
			if (address.addr.indexOf("@gmail") !== -1 && address.addr.indexOf("/") !== -1) {
				console.log("BAD GMAIL ADDRESS FIXED");
				address.addr = address.addr.substring(0, address.addr.indexOf("/"));
				// console.log("FIXED: "+address.addr);
			}
		}

		// lookup the conversation...
		console.info("DBModels.Conversation.findOrCreate: nesting db.find");
		var query = { from: DBModels.Conversations.id };
		if (address.addr === undefined) {
			console.error("DBModels.Conversations.findOrCreate address is undefined, setting to 'No Recipient'");
			address.addr = Messaging.Utils.kMissingAddress;
		}
		if (message.serviceName === undefined) {
			console.error("DBModels.Conversations.findOrCreate serviceName is undefined, setting to 'sms'");
			message.serviceName = "sms";
		}

		var normalizedAddress = Messaging.Utils.normalizeAddress(address.addr, message.serviceName);

		// If the person doesn't exist, then see if there's already a "non-contact" conversation for this address 
		if (person && person._id !== undefined) {
			query.where = [{prop:"personId", op:"=", val:person._id}];
		} else {
			// NOTE:
			// This used to query based on replyService as well.  By querying only on replyAddress, addresses with the
			// same value will be placed in the same chatthread.  This means that if you receive a GTalk message from 
			// john_smith and an AIM message from john_smith, they will be placed in the same chatthread.  This is making
			// the assumption that these two accounts are actually the same person which may not always be valid.  Another
			// edge case is that we could receive a message from an ICQ account of address 4085551234 and an SMS from 
			// the phone number 408-555-1234.  In that case, they would incorrectly be placed in the same chatthread.
			query.where = [{prop:"normalizedAddress", op:"%", val:normalizedAddress}];
		}

		var chatFuture = MojoDB.find(query, false);
		
		// Either update the existing conversation or create a new one
		chatFuture.then(function(future) {
			conversationList = future.result.results || [];
			//console.info("DBModels.Conversation.findOrCreate: find result " + JSON.stringify(future.result));
			var conversation = {
				_kind: DBModels.Conversations.id,
				personId: (person ? person._id : undefined)
			};
			
			// Result could be {} if the conversation doesn't exist
			if (conversationList.length > 0) {
				targetConversation = conversationList[0];
				conversation._id = targetConversation._id;				
				conversation.unreadCount = conversationList[0].unreadCount;
				Messaging.ChatThread._updateFromNewMessage(conversation, message, address);
				future.nest(MojoDB.merge([conversation]));
			} else if (message.groupChatName) {
				// The chatthread for this groupchat doesn't yet exist so put the message
				// in a dummy chatthread until an imgroupchat causes the chatthread to get created.
				console.info("Putting message in 'pending' because there's no group chatthread for "+message.groupChatName);
				var dummyConversation = { _id: DBModels.kMessagePendingGroupChatId };
				future.nest(DBModels.Messages.addConversation(message, dummyConversation, true));
			} else {
				// If the conversation doesn't yet have a displayName and it isn't a groupChat,
				// then incorporate the name given in the address (if any)
				if (!message.groupChatName && address.name) {
					console.info("inheriting displayName from addr.name: "+address.name);
					conversation.displayName = address.name;
				}

				Messaging.ChatThread._updateFromNewMessage(conversation, message, address);

				targetConversation = conversation;

				var creatorFunc = function() {
					
					var createChatFuture = DBModels.Conversations.lookupDisplayName(conversation);
					createChatFuture.then(this, function(createFuture) {
						// console.log("findOrCreate: got the name, now create the conversation " + JSON.stringify(createFuture.result));
						if (createFuture.result && createFuture.result.length > 0) {
							conversation.displayName = createFuture.result;
						}
						createFuture.nest(MojoDB.put([conversation]));
					});
					return createChatFuture;
				};
				future.nest(creatorFunc());
			}
		});
		
		chatFuture.then(function(future) {
			//console.info("DBModels.Conversation.findOrCreate: last 'then' targetConversation=" + JSON.stringify(targetConversation));
			//console.info("DBModels.Conversation.findOrCreate: last 'then' future.result=" + JSON.stringify(future.result));
			// targetConversation._id will be undefined if a new conversation was created in which case _id can be
			// had from the success result of the db.put() which looks something like [{"id": "1lk", "rev": 28}]
			if(targetConversation === undefined) {
				console.error("targetConversation is undefined!"); //  conversationList:" + JSON.stringify(conversationList));
			} else if (targetConversation._id === undefined && future.result.results.length > 0) {
				targetConversation._id = future.result.results[0].id;
			}

			future.result = targetConversation;
		});

		return chatFuture;
	},
		
	createEmpty: function(personId, addr, serviceName) {
		// Create the chatthread
		var person = {_id:personId};
		var message = {
			serviceName: serviceName,
			flags: {
				visible: false
			}
		};
		var address = {
			addr: addr
		};
		return DBModels.Conversations.findOrCreate(person, message, address);

	},
	
	// Query for a specific thread
	findThread: function(thread) {
		console.info("DBModels.Conversations.findThread: "+thread);
		var query = {
			from: DBModels.Conversations.id,
			select: ["_id", "summary", "timestamp", "flags"],
			where: [
				{prop: "_id", op: "=", val: thread}
			]
		};
		return MojoDB.find(query);
	}

};

/*********************************************************************************************
BuddyStatus 
*********************************************************************************************/
DBModels.BuddyStatus = {
	id: "com.palm.imbuddystatus:1",
	rev: 0,
	
	// Function getGroupAvailability() included in Unit testing
	getGroupAvailability: function(buddyStatusRecord, availability) {
		if (availability < Messaging.Availability.OFFLINE) {
			var group = buddyStatusRecord.group || Messaging.Utils.kDefaultBuddyGroup;
			return group.toLowerCase() + availability;
		} else {
			return "" + availability; // want all offline buddies to sort alphabetically by name so the groupAvailability should be same
		}
	},
	
	// Watch for all records with an empty displayName.  If the displayName is empty, it's likely that
	// this is a new buddy and will also have an empty personId.  
	getDisplayNameWatchQuery: function() {
		return {
			query: {
				from: DBModels.BuddyStatus.id,
				where: [
					{ prop: "displayName", op: "=", val: "" }
				]
			}
		};
	},
	
	// Watch for changes to availability
	getAvailabilityWatchQuery: function(revision) {
		revision = revision || this.rev;
		var q ={
			query: {
				from: DBModels.BuddyStatus.id,
				where: [
					{ prop: "availabilityRevSet", op: ">", val: revision }
				],
				limit: 1
			}
		};
		return q;
	},

	
	// Find buddies with no displayName set yet.  These are usually new buddies.
	findNewBuddies: function() {
		var query = {
			from: DBModels.BuddyStatus.id,
			where: [
				{ prop: "displayName", op: "=", val: "" }
			]
		};
		return TempDB.find(query, false);
	},

	// Find buddies that have had their availability updated
	findNewAvailability: function(revision) {
		revision = revision || this.rev;
		console.info("DBModels.BuddyStatus.findNewAvailability rev="+revision);

		// Query for a list of records with a revision number greater than the last availabilityRevSet value
		var query = {
			from: DBModels.BuddyStatus.id,
			where: [
				{ prop: "availabilityRevSet", op: ">", val:revision }
			]
		};
		var future = TempDB.find(query, false);
		future.then(this, function() {
			// console.log("updating rev!  Currently: "+this.rev);
			var results = future.result ? future.result.results : [];
			if(results.length > 0) {
				// console.log("UPDATING REV BASED ON: "+JSON.stringify(results[results.length-1]));
				this.rev = results[results.length-1].availabilityRevSet;
			} else {
				if( this.rev > 0 ) {
					console.error("DBModels.Person: Queried for rev "+this.rev+".!  We were told there were changes but none exist!");
				}
			}
			future.result = future.result;
		});
		return future;
	},

	// Set the displayName and personId for imbuddystatus records that do not have it set yet
	updateFromPerson: function(buddyStatusRecord, personRecord, checkRevision) {
		// If the buddy isn't valid, don't attempt to update it.
		if (!buddyStatusRecord._id || !buddyStatusRecord._rev) {
			return new Future().immediate();
		}

		var displayName;
		try {
			displayName = ContactsLib.Person.generateDisplayNameFromRawPerson(personRecord);
		} catch(e) {
			displayName = buddyStatusRecord.username || ".";
			console.error("updateFromPerson caught exception " + JSON.stringify(e));
		}
		var buddyChange = {
			_id: buddyStatusRecord._id,
			personId: personRecord._id,
			displayName: displayName
		};
		
		if (checkRevision) {
			buddyChange._rev = buddyStatusRecord._rev;
		}
		return TempDB.merge([buddyChange]);
	},
	
	// Update the groupAvailability field with the group field concatenated with the most available availability.
	// This field is used for sorting the buddy list.
	updatePersonAvailability: function(buddyStatusRecord) {
		var future = new Future();
		//console.log("updatePersonAvailability u="+buddyStatusRecord.username+", grp="+buddyStatusRecord.group);
		// we could have an empty budyStatusRecord here if there were no buddies to update
		if(buddyStatusRecord === undefined || (!buddyStatusRecord.personId && !buddyStatusRecord.username && !buddyStatusRecord.serviceName)) {
			console.error("updatePersonAvailability: No record to update!");
			future.result = true;
			return future;
		}

		var query;
		if (buddyStatusRecord.personId) {
			query = {
				from: DBModels.BuddyStatus.id,
				limit:50,
				where: [{ prop:"personId", op:"=", val:buddyStatusRecord.personId}]
			};
		} else {
			query = {
				from: DBModels.BuddyStatus.id,
				limit:50,
				where: [
					{ prop:"username", op:"=", val:buddyStatusRecord.username},
					{ prop:"serviceName", op:"=", val:buddyStatusRecord.serviceName}
				]
			};
		}
		// console.log("Look for all imbuddystatus records connected to the same person.  query:"+JSON.stringify(query));
		future = TempDB.find(query, false);
		future.then(this, function(future) {
			var i, mergeObject, returnFuture;
			var results = future.result ? future.result.results : [];
			var count = results ? results.length : 0;
			var mostAvailableState = 4;
			// console.log("Retrieved list of imbuddystatus records with personId "+buddyStatusRecord.personId);
			if(future.result) {
			//	console.log("future.result:"+JSON.stringify(future.result));
			} else {
				console.error("future.result is undefined!!");
			}
			
			//returnFuture = new Future();
			//returnFuture.result = true;
			
			// Find the most available state for this person
			for(i=0; i<count; i++) {
				if(results[i].availability !== undefined && results[i].availability < mostAvailableState) {
					// Found a more available state
					mostAvailableState = results[i].availability;
				}
			}
			// console.log("mostAvailableState: "+mostAvailableState);
			
			// Update the sortby field for each record linked to the person.
			var buddy, buddyUpdates = [];
			var groupHasPrimary = {}; // used to mark a buddy as primary for a given group
			for(i=0; i<count; i++) {
				var groupAvailability = DBModels.BuddyStatus.getGroupAvailability(results[i], mostAvailableState);
				groupAvailability = groupAvailability.toLowerCase();
				buddy = {
					_id: results[i]._id,
					primary: (groupHasPrimary[groupAvailability] === undefined),
					groupAvailability: groupAvailability,
					offline: (mostAvailableState === Messaging.Availability.OFFLINE),
					personAvailability: mostAvailableState
				};
				buddyUpdates.push(buddy);
				groupHasPrimary[groupAvailability] = true;
				// console.log("updating imbuddystatus["+results[i].displayName+"]: "+JSON.stringify(buddy));
			}
			future.nest(TempDB.merge(buddyUpdates));
			
			// console.log("nest the future only from the last merge call");
			//future.nest(returnFuture);
		});
		return future;
	}

};

DBModels.kMessagePendingGroupChatId = "pending_groupchat";

/*********************************************************************************************
Person 
*********************************************************************************************/
DBModels.Person = {
	id: "com.palm.person:1"
};

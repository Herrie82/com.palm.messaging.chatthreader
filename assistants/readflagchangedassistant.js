/*global _, Activity, Class, console, Date, DBModels, Future, include, mapReduce, MojoDB, PalmCall*/
/*
 * Copyright 2010 Palm, Inc.  All rights reserved.
 */

// Invoked whenever flags.read changes in a com.palm.message record.
var ReadFlagChangedCommandAssistant = Class.create({
	run: function(future) {
		this.readRevision = this.controller.args.readRev || 0;
		
		// Get all the messages that have flags.read changes
		future.now(this, function(future) {
			// PERFORMANCE FIX: Only select fields needed for processing
			var query = {
				from: DBModels.Messages.id,
				select: ["_id", "readRevSet", "conversations"],
				where: [
					{ prop: "readRevSet", op: ">", val: this.readRevision }
				]
			};
			future.nest(MojoDB.find(query));
		});

		future.then(this, function(future) {
			var messagesList = future.result ? future.result.results : [];
			console.info("ReadFlagChangedCommandAssistant: changed messages=" +messagesList.length);
			if (messagesList.length > 0) {
				var revision = this.readRevision,
					chatThreadIdList = [],
					chatThreadIds = {};
				//collate the chatthreads for all the changed messages and update the unread count for each chatthread
				messagesList.forEach(function(message) {
					if (message.readRevSet > revision) {
						revision = message.readRevSet;
					}

					if (message.conversations) {
						message.conversations.forEach(function(chatId) {
							if (chatId && chatThreadIds[chatId] !== true) {
								chatThreadIds[chatId] = true;
								chatThreadIdList.push(chatId);
							}
						});
					}
				});
				this.readRevision = revision;
				var mapFunc = _.bind(this.updateChatThreads, this);
				return mapReduce({map:mapFunc}, chatThreadIdList);
			} else {
				console.error("ReadFlagChangedCommandAssistant: the activity fired but no messages have read changes.");
				this.readRevision = this.readRevision + 1;
				future.result = true;
			}
		});
	},

	// Complete the activity with restart
	complete: function(activity) {
		console.info("ReadFlagChangedCommandAssistant:complete activity " +activity._activityId);
		var restartParams = {
			activityId: activity._activityId,
			restart: true,
			trigger: {
				method: "palm://com.palm.db/watch",
				key: "fired",
				params: {
					query: {
						from: DBModels.Messages.id,
						where: [
							{ prop: "readRevSet", op: ">", val: this.readRevision }
						]
					}
				}
			},
			callback: {
				method: "palm://com.palm.messaging.chatthreader/readFlagChanged",
				params: { readRev: this.readRevision }
			}
		};
		return PalmCall.call(activity._service, "complete", restartParams);
	},
	
	updateChatThreads: function(chatThreadId) {
		// PERFORMANCE FIX: Only query for unread messages instead of all messages
		// Only select fields needed for unread check to reduce data transfer
		var query = {
			from: DBModels.Messages.id,
			select: ["_id", "flags", "folder"],
			where: [
				{ prop: "conversations", op: "=", val: chatThreadId },
				{ prop: "flags.read", op: "=", val: false },
				{ prop: "folder", op: "=", val: "inbox" }
			]
		};
		var future = MojoDB.find(query);
		future.then(this, function(future) {
			// Count is simply the number of results since we only queried unread inbox messages
			var unreadCount = future.result && future.result.results ? future.result.results.length : 0;

			console.info("ReadFlagChangedCommandAssistant.updateChatThreads chatId=" + chatThreadId + " unreadCount=" + unreadCount);

			var chatThreadRecord = {
				"_id": chatThreadId,
				"unreadCount": unreadCount
			};
			future.nest(MojoDB.merge([chatThreadRecord]));
		});

		return future;
	}
});



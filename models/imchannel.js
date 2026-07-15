/*global console, DBModels, Future, MojoDB, Messaging*/
/*
 * Copyright 2010 Palm, Inc.  All rights reserved.
 */

// Servers/Rooms (Milestone 1): a room/channel inside an imserver (a Discord text channel, IRC
// channel, Teams/Slack channel, Matrix room). Created on demand by the channel-routing branch in
// DBModels.Conversations.findOrCreate. Deduped on (serviceName, remoteId=channelName) via the
// imchannel byRemoteId index. Each channel is linked 1:1 to a chatthread (chatThreadId), exactly
// like an imgroupchat - the chatthread holds the message list; the imchannel gives it a parent
// server so the Servers-tab UI can present server -> channel. parentId/path stay unused for flat
// 2-level services (IRC) and carry categories/subspaces for Discord/Matrix later.
DBModels.ImChannel = {
	id: "com.palm.imchannel:1",

	// Resolve the imchannel record for a channel message, creating it if absent. serverRecId is the
	// _id of the owning imserver. future.result = the imchannel record (with _id).
	findOrCreate: function(message, serverRecId) {
		var serviceName = message.serviceName || "";
		var remoteId = message.channelName || "";
		var channelRecord;

		var query = {
			from: DBModels.ImChannel.id,
			where: [
				{ prop: "serviceName", op: "=", val: serviceName },
				{ prop: "remoteId", op: "=", val: remoteId }
			]
		};

		var future = MojoDB.find(query, false);
		future.then(this, function(future) {
			var list = future.result.results || [];
			if (list.length > 0) {
				// Existing channel - reuse it (already carries its _id and chatThreadId if linked).
				channelRecord = list[0];
				future.result = channelRecord;
			} else {
				channelRecord = {
					_kind: DBModels.ImChannel.id,
					remoteId: remoteId,
					serviceName: serviceName,
					serverId: serverRecId,
					parentId: null,
					type: "channel",
					// No human channel name is available from the transport yet (purple-discord's
					// conversation name is the channel snowflake), so seed name with the remote id
					// and displayName with the server name; a later milestone can refine these.
					name: remoteId,
					displayName: message.serverName || remoteId,
					position: 0
				};
				future.nest(MojoDB.put([channelRecord]));
			}
		});
		// Stamp the assigned _id onto a freshly-created record (no-op when we reused one).
		future.then(this, function(future) {
			if (channelRecord && channelRecord._id === undefined &&
					future.result.results && future.result.results.length > 0) {
				channelRecord._id = future.result.results[0].id;
			}
			future.result = channelRecord;
		});
		return future;
	},

	// Link a freshly-created chatthread back onto the imchannel (mirrors how
	// NewGroupChatCommandAssistant writes chatThreadId onto an imgroupchat).
	setChatThreadId: function(channelRecId, chatThreadId) {
		return MojoDB.merge([{ _id: channelRecId, chatThreadId: chatThreadId }]);
	}
};

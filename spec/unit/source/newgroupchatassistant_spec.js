describe('Chat Threader NewGroupChatCommandAssistant Unit Test', function() {
	it('NewGroupChatCommandAssistant.getModifiedChatThreadRecord() Test', function() {	
		var newGroupChatCommandAssistant = new NewGroupChatCommandAssistant();
		var groupChat = {"_id":"1234"};
		var chatThreadRecord = {"personId":"myId", "flags":{"locked":true}};	
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).personId).toBeNull();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).flags.locked).toBeFalsy();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).groupChatId).toEqual(groupChat._id);
	
		chatThreadRecord = {"personId":"myId", "flags":{"locked":false}};
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).personId).toBeNull();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).flags.locked).toBeFalsy();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).groupChatId).toEqual(groupChat._id);

		chatThreadRecord = {"personId":"myId"};
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).personId).toBeNull();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).flags.locked).toBeFalsy();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).groupChatId).toEqual(groupChat._id);

		chatThreadRecord = {};
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).personId).toBeUndefined();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).flags.locked).toBeFalsy();
		expect(newGroupChatCommandAssistant.getModifiedChatThreadRecord(groupChat, chatThreadRecord).groupChatId).toEqual(groupChat._id);		
	});	

})
describe('Chat Threader LockedGroupChatCommandAssistant Unit Test', function() {

	it('LockedGroupChatCommandAssistant.getUpdatedChatThreadRecord() Test', function() {
	    var lockedGroupChatCommandAssistant = new LockedGroupChatCommandAssistant();
		var future = {"result": {"results": [{"_id": "++12345"}]}};
		var groupChat = {};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)).toBeUndefined();
		
		future = {"result": {"results": [{"_id": "++12345"}]}};
		groupChat = {"flags": {"locked": true}};	
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)._id).toEqual("++12345");
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat).flags.locked).toBeTruthy();
		
		future = {"result": {"results": [{"_id": "++12345"}]}};
		groupChat = {"flags": {"locked": false}};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)).toBeUndefined();
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": true}}]}};
		groupChat = {};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)._id).toEqual("++12345");
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": true}}]}};
		groupChat = {};	
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat).flags.locked).toBeFalsy();
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": true}}]}};
		groupChat = {"flags": {"locked": true}};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)).toBeUndefined();
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": true}}]}};
		groupChat = {"flags": {"locked": false}};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)._id).toEqual("++12345");
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": true}}]}};
		groupChat = {"flags": {"locked": false}};		
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat).flags.locked).toBeFalsy();
			
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": false}}]}};
		groupChat = {};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)).toBeUndefined();
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": false}}]}};
		groupChat = {"flags": {"locked": true}};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)._id).toEqual("++12345");
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": false}}]}};
		groupChat = {"flags": {"locked": true}};		
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat).flags.locked).toBeTruthy();
		
		future = {"result": {"results": [{"_id": "++12345", "flags": {"locked": false}}]}};
		groupChat = {"flags": {"locked": false}};
		expect(lockedGroupChatCommandAssistant.getUpdatedChatThreadRecord(future, groupChat)).toBeUndefined();
     });	

});
describe('Chat Threader DeletedMessageCommandAssistant Unit Test', function() {
	
	it('DeletedMessageCommandAssistant.shouldUpdateChatThread() Test', function() {		
		var deletedMessageCommandAssistant = new DeletedMessageCommandAssistant();
		var chatThread = {"timestamp":"11", "summary":"Hi there!", "flags":{"outgoing": true}};
		var message = {"localTimestamp":"10", "messageText":"Hi there!", "folder":"inbox"};		
		expect(deletedMessageCommandAssistant.shouldUpdateChatThread(chatThread, message)).toBeTruthy();
		
		chatThread = {"timestamp":"10", "summary":"Hi there!", "flags":{"outgoing": true}};
		message = {"localTimestamp":"10", "messageText":"Go Away...", "folder":"inbox"};
		expect(deletedMessageCommandAssistant.shouldUpdateChatThread(chatThread, message)).toBeTruthy();

		chatThread = {"timestamp":"10", "summary":"Hi there!", "flags":{"outgoing": true}};
		message = {"localTimestamp":"10", "messageText":"Hi there!", "folder":"inbox"};
		expect(deletedMessageCommandAssistant.shouldUpdateChatThread(chatThread, message)).toBeTruthy();

		chatThread = {"timestamp":"10", "summary":"Hi there!", "flags":{"outgoing": true}};
		message = {"localTimestamp":"10", "messageText":"Hi there!", "folder":"outbox"};
		expect(deletedMessageCommandAssistant.shouldUpdateChatThread(chatThread, message)).toBeFalsy();

		chatThread = {"timestamp":"10", "summary":"Hi there!", "flags":{"outgoing": false}};
		message = {"localTimestamp":"10", "messageText":"Hi there!", "folder":"outbox"};
		expect(deletedMessageCommandAssistant.shouldUpdateChatThread(chatThread, message)).toBeFalsy();

	});	
	
})

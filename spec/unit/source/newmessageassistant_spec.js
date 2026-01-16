describe('Chat Threader NewMessagesCommandAssistant Unit Test', function() {
	
	it('NewMessagesCommandAssistant.convertAddressToObject() Test', function() {
		var newMessagesCommandAssistant = new NewMessagesCommandAssistant();
		var address = undefined;
		expect(newMessagesCommandAssistant.convertAddressToObject(address).addr).toEqual(Messaging.Utils.kMissingAddress);
		
		address = null;
		expect(newMessagesCommandAssistant.convertAddressToObject(address).addr).toEqual(Messaging.Utils.kMissingAddress);
		
		address = "";
		expect(newMessagesCommandAssistant.convertAddressToObject(address).addr).toEqual("");
		
		address = "my address";
		expect(newMessagesCommandAssistant.convertAddressToObject(address).addr).toEqual("my address");
		
		address = {"addr":"my address"};
		expect(newMessagesCommandAssistant.convertAddressToObject(address).addr).toEqual("my address");
	});	

	it('NewMessagesCommandAssistant.getPerson() Test', function() {			
		var newMessagesCommandAssistant = new NewMessagesCommandAssistant();
		var future = {result:["person 1"]};
		expect(newMessagesCommandAssistant.getPerson(future)).toEqual("person 1");
		
		future = {result:["person 1", "person 2", "person 3"]};
		expect(newMessagesCommandAssistant.getPerson(future)).toEqual("person 1");
		
		future = {result:["person 1"]};
		expect(newMessagesCommandAssistant.getPerson(future)).toEqual("person 1");		
	});	
	
	it('NewMessagesCommandAssistant.getUsername() Test', function() {			
		var newMessagesCommandAssistant = new NewMessagesCommandAssistant();
		var message = {};
		expect(newMessagesCommandAssistant.getUsername(message)).toBeUndefined();
		
		message = {"folder":"inbox", "to":["me"]}
		expect(newMessagesCommandAssistant.getUsername(message)).toEqual("me");
		
		message = {"folder":"inbox", "to":[""]}
		expect(newMessagesCommandAssistant.getUsername(message)).toEqual("");
		
		message = {"folder":"inbox"}
		expect(newMessagesCommandAssistant.getUsername(message)).toBeUndefined();
		
		message = {"from":"someone"}
		expect(newMessagesCommandAssistant.getUsername(message)).toEqual("someone");
	});	
	
	it('NewMessagesCommandAssistant.getAccountIds() Test', function() {			
		var newMessagesCommandAssistant = new NewMessagesCommandAssistant();
		var contacts = [{"accountId":"1", "ims":[{"type":"type_yahoo"}]}];
		var serviceName = "type_yahoo";
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName).length).toEqual(1);
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName)[0]).toEqual("1");
		
		contacts = [{"accountId":"1", "ims":[{"type":"type_yahoo"}]},
		            {"accountId":"2", "ims":[{"type":"type_yahoo"}]},
		            {"accountId":"3", "ims":[{"type":"type_yahoo"}]},
		            {"accountId":"4", "ims":[{"type":"type_gtalk"}]}
		           ];
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName).length).toEqual(3);
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName)[0]).toEqual("1");
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName)[1]).toEqual("2");
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName)[2]).toEqual("3");
	
		serviceName = "type_gtalk";
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName).length).toEqual(1);
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName)[0]).toEqual("4");
		
		serviceName = "type_aim";
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName).length).toEqual(0);

		contacts = [];
		expect(newMessagesCommandAssistant.getAccountIds(contacts, serviceName).length).toEqual(0);
	});	

})
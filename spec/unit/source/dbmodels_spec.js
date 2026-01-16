describe('Chat Threader DBModels Unit Test', function() {
		
	it('DBModels Test', function() {
		expect(DBModels).toBeDefined();
	});	
	
	it('DBModels.Messages.id Test', function() {
		expect(DBModels.Messages.id).toEqual("com.palm.message:1");
	});	

	it('DBModels.Conversations.id Test', function() {		
		expect(DBModels.Conversations.id).toEqual("com.palm.chatthread:1");
	});	

	it('DBModels.BuddyStatus.id Test', function() {		
		expect(DBModels.BuddyStatus.id).toEqual("com.palm.imbuddystatus:1");
	});	

	it('DBModels.BuddyStatus.getGroupAvailability() Test', function() {	
		var buddyStatusRecord = {};
		var availability = 0;
		expect(DBModels.BuddyStatus.getGroupAvailability(buddyStatusRecord, availability)).toEqual("buddies0");
		
		buddyStatusRecord = {"group":"Friends"};
		availability = 1;
		expect(DBModels.BuddyStatus.getGroupAvailability(buddyStatusRecord, availability)).toEqual("friends1");	
		
		buddyStatusRecord = {"group":"Friends"};
		availability = 0;
		expect(DBModels.BuddyStatus.getGroupAvailability(buddyStatusRecord, availability)).toEqual("friends0");
		
		buddyStatusRecord = {"group":"Family"};
		availability = 4;
		expect(DBModels.BuddyStatus.getGroupAvailability(buddyStatusRecord, availability)).toEqual("4");		
		
	});	

	it('DBModels.Person.id Test', function() {		
		expect(DBModels.Person.id).toEqual("com.palm.person:1");
	});		

});
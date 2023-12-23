// Various helpers

(function()
{

	// ____________________________________________________________________________________________________
	//
	//     Enums
	// ____________________________________________________________________________________________________
	//

	// Being the awful nasty langauge that it is, javascript has no enums so we have to make our own
	// The strategy below is taken directly from typescript
	TFP.CreateEnum = function(memberNames)
	{
		let enumClass = {};
		memberNames.forEach((memberName, index) =>
		{
			enumClass[enumClass[index] = memberName] = index;
		});
		return enumClass;
	}


})();

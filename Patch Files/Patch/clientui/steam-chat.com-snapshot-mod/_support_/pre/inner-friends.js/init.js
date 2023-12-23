// Patch scope initialization


// ____________________________________________________________________________________________________
//
//     Interface container
// ____________________________________________________________________________________________________
//

// Each file in /pre declares members that other files need to access
// To avoid conflict with existing window-bound members and to keep things tidy, everything created by the patch's JS will exist on a single window-bound object, which we create here

var TFP = {};

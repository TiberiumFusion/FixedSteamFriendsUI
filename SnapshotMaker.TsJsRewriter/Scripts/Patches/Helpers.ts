// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Helpers for the patch definitions
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

namespace SnapshotMakerTsJsRewriter.Patches
{

    // ____________________________________________________________________________________________________
    //
    //     AST
    // ____________________________________________________________________________________________________
    //

    export function AstFindFirstAncestor(node: ts.Node, ...kind: ts.SyntaxKind[])
    {
        let curNode: ts.Node = node;
        do
        {
            curNode = curNode.parent;

            if (curNode == null)
                return null;

            else if (kind.indexOf(curNode.kind) != -1)
                return curNode;
        }
        while (curNode.parent != null)

        return null;
    }

}
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

    export function AstFindFirstAncestor(node: ts.Node, ...kind: ts.SyntaxKind[]): ts.Node
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

    export function AstGetAllChildNodes(node: ts.Node, filterCallback: ((n: ts.Node) => boolean), cullCallback: ((n: ts.Node) => boolean) = null, maximumDepth: number = 0): ts.Node[]
    {
        let nodes: ts.Node[] = [];

        let seenNodes: Record<string, boolean> = {};

        function recurse(curNode: ts.Node, depth: number)
        {
            let seenNodeId: string = curNode.pos.toString() + "-" + curNode.end.toString(); // there's no unique hash value for each node, but the start + end pos in the source file of each node is a unique & cheap identifier
            if (seenNodeId in seenNodes) // I don't know if cyclical references are possible in typescript's ast model, so it's possible this isn't even needed
                return;

            seenNodes[seenNodeId] = true;

            for (let child of curNode.getChildren())
            {
                if (cullCallback != null && !cullCallback(child))
                    continue;

                let addToList: boolean = true;
                if (filterCallback != null)
                    addToList = filterCallback(child);

                if (addToList)
                    nodes.push(child);

                let nextDepth = depth + 1;
                if (nextDepth > maximumDepth)
                    continue;

                recurse(child, nextDepth);
            }
        }

        recurse(node, 0);

        return nodes;
    }

}
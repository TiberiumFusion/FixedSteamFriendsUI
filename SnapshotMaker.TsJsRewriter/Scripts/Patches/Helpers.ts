﻿// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

    export function AstFindFirstAncestor(node: ts.Node, kind: ts.SyntaxKind | ts.SyntaxKind[], maximumDepth: number = 0): ts.Node
    {
        let matchKinds: ts.SyntaxKind[];
        if (Array.isArray(kind))
            matchKinds = kind;
        else
            matchKinds = [kind];

        let curNode: ts.Node = node;
        let depth: number = 0;

        do
        {
            curNode = curNode.parent;

            if (curNode == null)
                return null;

            depth++;

            if (maximumDepth > 0 && depth > maximumDepth)
                return null;

            else if (matchKinds.indexOf(curNode.kind) != -1)
                return curNode;
        }
        while (curNode.parent != null)

        return null;
    }

    export function AstGetAllChildNodes(node: ts.Node, filterCallback: ((n: ts.Node) => boolean) = null, cullCallback: ((n: ts.Node) => boolean) = null, maximumDepth: number = 0): ts.Node[]
    {
        let nodes: ts.Node[] = [];

        let seenNodes: Record<string, boolean> = {};

        function recurse(curNode: ts.Node, depth: number)
        {
            let seenNodeId: string = curNode.pos.toString() + "-" + curNode.end.toString(); // there's no unique hash value for each node, but the start + end pos in the source file of each node is a unique & cheap identifier
            if (seenNodeId in seenNodes) // I don't know if cyclical references are possible in typescript's ast model, so it's possible this isn't even needed
                return;

            seenNodes[seenNodeId] = true;

            let children: ts.Node[];

            if (ts.isBlock(curNode))
                children = [ ...(curNode as ts.Block).statements ]; // for some reason, typescript does not consider Statements to be children of Blocks. Instead, the root Nodes of each Statement are the "immediate" children of the Block.
            else
                children = curNode.getChildren();

            for (let child of children)
            {
                if (cullCallback != null && !cullCallback(child))
                    continue;

                let addToList: boolean = true;
                if (filterCallback != null)
                    addToList = filterCallback(child);

                if (addToList)
                    nodes.push(child);

                let nextDepth = depth + 1;
                if (maximumDepth > 0 && nextDepth > maximumDepth)
                    continue;

                recurse(child, nextDepth);
            }
        }

        recurse(node, 0);

        return nodes;
    }

}
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    var Patches;
    (function (Patches) {
        function AstFindFirstAncestor(node, kind, maximumDepth) {
            if (maximumDepth === void 0) { maximumDepth = 0; }
            var matchKinds;
            if (Array.isArray(kind))
                matchKinds = kind;
            else
                matchKinds = [kind];
            var curNode = node;
            var depth = 0;
            do {
                curNode = curNode.parent;
                if (curNode == null)
                    return null;
                depth++;
                if (maximumDepth > 0 && depth > maximumDepth)
                    return null;
                else if (matchKinds.indexOf(curNode.kind) != -1)
                    return curNode;
            } while (curNode.parent != null);
            return null;
        }
        Patches.AstFindFirstAncestor = AstFindFirstAncestor;
        function AstGetAllChildNodes(node, filterCallback, cullCallback, maximumDepth) {
            if (filterCallback === void 0) { filterCallback = null; }
            if (cullCallback === void 0) { cullCallback = null; }
            if (maximumDepth === void 0) { maximumDepth = 0; }
            var nodes = [];
            var seenNodes = {};
            function recurse(curNode, depth) {
                var seenNodeId = curNode.pos.toString() + "-" + curNode.end.toString();
                if (seenNodeId in seenNodes)
                    return;
                seenNodes[seenNodeId] = true;
                var children;
                if (ts.isBlock(curNode))
                    children = __spreadArray([], curNode.statements, true);
                else
                    children = curNode.getChildren();
                for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                    var child = children_1[_i];
                    if (cullCallback != null && !cullCallback(child))
                        continue;
                    var addToList = true;
                    if (filterCallback != null)
                        addToList = filterCallback(child);
                    if (addToList)
                        nodes.push(child);
                    var nextDepth = depth + 1;
                    if (maximumDepth > 0 && nextDepth > maximumDepth)
                        continue;
                    recurse(child, nextDepth);
                }
            }
            recurse(node, 0);
            return nodes;
        }
        Patches.AstGetAllChildNodes = AstGetAllChildNodes;
    })(Patches = SnapshotMakerTsJsRewriter.Patches || (SnapshotMakerTsJsRewriter.Patches = {}));
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));

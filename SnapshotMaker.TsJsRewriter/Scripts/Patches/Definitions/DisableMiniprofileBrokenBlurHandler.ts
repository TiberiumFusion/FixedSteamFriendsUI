// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable broken (t.m_BlurHandler = () => { this.HideByElement(t.m_OwningElement); }) code in the ShowPopup() handler for miniprofiles
/*

    ----- Targets -----

    1.  (8601984: line 13927)
        (t.m_BlurHandler = () => {
            this.HideByElement(t.m_OwningElement);
        }),
      =>
        (t.m_BlurHandler = () => {
            // removed
        }),

    
    ----- Notes -----

    This appears to be Valve's attempt to add a visual effect when a miniprofile is displayed.
    I don't know what the intended effect is, but it possibly is meant to blur the parent window which created the miniprofile, which would be pretty retarded.

    Regardless, it doesn't work properly in the December 2022 client. It ends up making the miniprofile immediately close itself, since the miniprofile's m_OwningElement is itself. But only when the window which created the miniprofile popup has focus. If a different window has focus, the miniprofile works properly. Clearly a symptom of some more rootward problem.

    This problem does not occur in the May 2023 client.

    This effect appears to be written expressly for pure shit steam clients and thus has no reason to attempt itself on vgui capable Steam clients. In fact, despite not causing any problems in the May 2023, it does absolutely nothing to affect the look & behavior of the miniprofiles. They are the same whether or not this code is disabled/enabled.
    Accordingly, disabling this code fixes the aforementioned issue under the Dec 2022 client and renders no changes to the unaffected clients.

*/
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/// <reference path="../Patches.ts" />
// Required ^ hack to make TS realize that ConfiguredPatchDefinitionFactory is defined in a different file; otherwise, it complains "'xyz' is used before its declaration" (see: https://stackoverflow.com/a/48189989/2489580)


namespace SnapshotMakerTsJsRewriter.Patches.Definitions
{
    export class DisableMiniprofileBrokenBlurHandlerCPDF extends ConfiguredPatchDefinitionFactory
    {
        PatchIdName = "DisableMiniprofileBrokenBlurHandler";

        CreatePatchDefinition(): PatchDefinition
        {
            return new PatchDefinition(this.PatchIdName,

                // ____________________________________________________________________________________________________
                //
                //     Patch
                // ____________________________________________________________________________________________________
                //

                (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node, detectionInfoData: any) =>
                {
                    let tnode: ts.Block = detectionInfoData.TypedNode; // e.g.  { this.HideByElement(t.m_OwningElement); }
                    let targetStatement: ts.Statement = detectionInfoData.TargetStatement; // e.g.  this.HideByElement(t.m_OwningElement);

                    let targetStatementJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, targetStatement, sourceFile);

                    // Remove target statement from function body and insert comment of old JS
                    let newStatements: ts.Statement[] = [];
                    tnode.statements.forEach((statement, index) =>
                    {
                        if (statement == targetStatement)
                        {
                            if (IncludeOldJsCommentAtPatchSites)
                            {
                                let commentAnchorStatement = context.factory.createEmptyStatement(); // afaik this is the only way to insert a line-exclusive comment in all scenarios, including when there are no other statements to anchor it to (i.e. the removed target statement was the only statement in the function body)
                                newStatements.push(commentAnchorStatement);
                                ts.addSyntheticLeadingComment(commentAnchorStatement, ts.SyntaxKind.MultiLineCommentTrivia, targetStatementJs, false);
                            }
                        }
                        else
                        {
                            newStatements.push(statement);
                        }
                    });

                    return context.factory.updateBlock(tnode, newStatements);
                },


                // ____________________________________________________________________________________________________
                //
                //     Detections
                // ____________________________________________________________________________________________________
                //

                [
                    (context: ts.TransformationContext, sourceFile: ts.SourceFile, node: ts.Node) =>
                    {
                        if (node.kind == ts.SyntaxKind.Block) // e.g.  { this.HideByElement(t.m_OwningElement); }
                        {
                            let tnode = node as ts.Block;

                            let matchedStatement: ts.Statement = null;
                            for (let statement of tnode.statements) // e.g.  this.HideByElement(t.m_OwningElement);
                            {
                                let statementJs: string = JsEmitPrinter.printNode(ts.EmitHint.Unspecified, statement, sourceFile);
                                if (statementJs.includes("HideByElement")) // not a precise detection, but it's highly unlikely to collide
                                {
                                    matchedStatement = statement;
                                    break;
                                }
                            }

                            if (matchedStatement != null)
                            {
                                if (tnode.parent.kind == ts.SyntaxKind.ArrowFunction) // e.g.  () => { this.HideByElement(t.m_OwningElement); }
                                {
                                    // Currently this is an ArrowFunction in valve's bastardized js, but it might change)
                                    let func = tnode.parent as ts.ArrowFunction;
                                    if (func.parent.kind == ts.SyntaxKind.BinaryExpression) // e.g.  t.m_BlurHandler = () => { this.HideByElement(t.m_OwningElement); }
                                    {
                                        let memberFuncAssign = func.parent as ts.BinaryExpression;
                                        if (memberFuncAssign.left.kind == ts.SyntaxKind.PropertyAccessExpression) // e.g.  t.m_BlurHandler
                                        {
                                            let memberProperty = memberFuncAssign.left as ts.PropertyAccessExpression;
                                            if (memberProperty.name.kind == ts.SyntaxKind.Identifier) // e.g.  m_BlurHandler
                                            {
                                                let memberPropertyName = memberProperty.name as ts.Identifier;
                                                if (memberPropertyName.escapedText == "m_BlurHandler")
                                                {
                                                    return new DetectionInfo(true, {
                                                        "TypedNode": tnode,
                                                        "TargetStatement": matchedStatement,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ],

            );
        }
    }
    
}

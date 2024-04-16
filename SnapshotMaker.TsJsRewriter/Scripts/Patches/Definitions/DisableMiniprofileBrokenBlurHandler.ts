// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Disable broken (t.m_BlurHandler = () => { this.HideByElement(t.m_OwningElement); }) code in the ShowPopup() handler for miniprofiles
//
//    Examples:
//      1.  (t.m_BlurHandler = () => {
//			    this.HideByElement(t.m_OwningElement);
//			}),
//       -> (t.m_BlurHandler = () => {
//			    /*this.HideByElement(t.m_OwningElement);*/
//			}),
//
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

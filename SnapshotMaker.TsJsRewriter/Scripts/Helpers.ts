namespace SnapshotMakerTsJsRewriter
{
    
    // ____________________________________________________________________________________________________
    //
    //     Tracing
    // ____________________________________________________________________________________________________
    //

    // Our functions call this
    export function Trace(...message: any[])
    {
        if (!EnableTraces)
            return;

        UserTraceHandler(...message);
    }

    // User can replace this with their own trace handler
    export function UserTraceHandler(...message: any[])
    {
        console.log(...message);
    }



    // ____________________________________________________________________________________________________
    //
    //     TypeScript js emission
    // ____________________________________________________________________________________________________
    //

    // General purpose formatted JS code string provider for nodes and source files
    export var JsEmitPrinter: ts.Printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });



    // ____________________________________________________________________________________________________
    //
    //     String handling
    // ____________________________________________________________________________________________________
    //

    // Given:   "some\full\or partial.url?with=urlvars&thatwe=dontwant"
    // Returns: "some\full\or partial.url"
    export function RemoveQueryTailFromUrl(url: string): string
    {
        let qPos: number = url.indexOf('?');
        if (qPos == -1)
            return url;
        else
            return url.substr(0, qPos);
    }

}
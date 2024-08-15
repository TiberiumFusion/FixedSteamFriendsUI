var SnapshotMakerTsJsRewriter;
(function (SnapshotMakerTsJsRewriter) {
    function Trace() {
        var message = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            message[_i] = arguments[_i];
        }
        if (!SnapshotMakerTsJsRewriter.EnableTraces)
            return;
        SnapshotMakerTsJsRewriter.UserTraceHandler.apply(SnapshotMakerTsJsRewriter, message);
    }
    SnapshotMakerTsJsRewriter.Trace = Trace;
    function UserTraceHandler() {
        var message = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            message[_i] = arguments[_i];
        }
        console.log.apply(console, message);
    }
    SnapshotMakerTsJsRewriter.UserTraceHandler = UserTraceHandler;
    SnapshotMakerTsJsRewriter.JsEmitPrinter = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    function RemoveQueryTailFromUrl(url) {
        var qPos = url.indexOf('?');
        if (qPos == -1)
            return url;
        else
            return url.substr(0, qPos);
    }
    SnapshotMakerTsJsRewriter.RemoveQueryTailFromUrl = RemoveQueryTailFromUrl;
})(SnapshotMakerTsJsRewriter || (SnapshotMakerTsJsRewriter = {}));

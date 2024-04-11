using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker.CefJsProvider
{

    public class CefSharpInitException : Exception
    {
        public CefSharpInitException() { }
    }

    /// <summary>
    /// Exception for when some javascript eval() in the cef browser throws an exception which CefSharp (optionally) translates and then propagates to C#.
    /// </summary>
    /// <remarks>
    /// "ExceptionException" is not a typo. It distinctifies this from the other type of js eval failure.
    /// </remarks>
    public class CefSharpJavascriptEvalExceptionException : Exception
    {
        public AggregateException CefSharpInteropException { get; private set; }
        public CefSharpJavascriptEvalExceptionException(AggregateException cefSharpInteropException)
        {
            CefSharpInteropException = cefSharpInteropException;
        }
    }

    /// <summary>
    /// Exception for when some javascript eval() in the cef browser fails, but no exception is propagated to C# by CefSharp.
    /// </summary>
    public class CefSharpJavascriptEvalFailureException : Exception
    {
        public string JsEvalFailureMessage { get; private set; }
        public CefSharpJavascriptEvalFailureException(string jsEvalFailureMessage)
        {
            JsEvalFailureMessage = jsEvalFailureMessage;
        }
    }

}

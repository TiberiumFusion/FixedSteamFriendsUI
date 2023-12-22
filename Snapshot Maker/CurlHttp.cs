using System;
using System.Collections.Generic;
using System.Text;
using CurlThin;
using CurlThin.Enums;
using CurlThin.Helpers;
using CurlThin.Native;
using CurlThin.SafeHandles;

namespace TiberiumFusion.FixedSteamFriendsUI.SnapshotMaker
{
    public static class CurlHttp
    {
        // For some obnoxious reason, Valve has configured steam-chat.com to be 1) always HTTPS and 2) use an extremely tiny set of cipher suites

        // As of 2023-12-18, they are:
        // TLS 1.2
        //   TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 (0xc030)        ECDH   secp256r1 (eq. 3072 bits RSA)   FS  256
        //   TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 (0xc02f)        ECDH   secp256r1 (eq. 3072 bits RSA)   FS  128
        //   TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256 (0xcca8)  ECDH   secp256r1 (eq. 3072 bits RSA)   FS  256P
        // TLS 1.3
        //   TLS_AES_256_GCM_SHA384 (0x1302)                       ECDH   x25519 (eq. 3072 bits RSA)      FS  256
        //   TLS_CHACHA20_POLY1305_SHA256 (0x1303)                 ECDH   x25519 (eq. 3072 bits RSA)      FS  256P
        //   TLS_AES_128_GCM_SHA256 (0x1301)                       ECDH   x25519 (eq. 3072 bits RSA)      FS  128

        // None of these are supported by Schannel, which means we cannot use any http/web client api in .NET. Great. Thanks Valve! Thanks Microsoft!

        // So I'm using "CurlThin" instead, not because I want to, but because it appears to be the only ready-made, alternate HTTP(S) client available for .NET
        // Unfortunately, CurlThin targets the amorphous .NET Standard 2.0, but it fails to do so properly, because its PInvoke to libcurl.dll exclusively uses the .NET Core calling convention.
        // Which means CurlThin is incompatible with .NET 4.6+. Which is why this is unfortunately a .NET Core project.

        // This class provides a more convenient interface to using CurlThin for our purposes

        public static void Initialize()
        {
            // CurlThin is a fitting name. There is zero abstraction, it is extremely procedural, and all managed calls directly map to exports from libcurl.dll.
            CurlResources.Init(); // Which means libcurl.dll (and its dependencies) must be in our path, so this method deploys libcurl.dll, libssl-1_1-x64.dll, libcrypto-1_1-x64.dll, and curl-ca-bundle.crt to the working directory.

            // Now that the PEs are deployed, the curl library must be loaded and initialized
            CURLcode ccGlobalInit = CurlNative.Init();
            if (ccGlobalInit != CURLcode.OK)
            {
                throw new CurlHttpInitException(ccGlobalInit);
            }
            
            // And we also need a handle to the basic curl interface
            HCurlEasy = CurlNative.Easy.Init();
        }

        private static SafeEasyHandle HCurlEasy; // One handle to use for all HTTP requests
        // Reusing the same handle (via Reset()) allows us to retain its live connection states, dns cache, and cookies between HTTP requests
        // This more closely mirrors the behavior of viewing steam-chat.com in a web browser, which is a known good configuration for accessing the files at steam-chat.com 

        
        public static byte[] FetchResource(string url)
        {
            CurlNative.Easy.Reset(HCurlEasy); // Keep page logic and server response data, but reset the handle interface so we can make a fresh request

            // Request set up
            CurlNative.Easy.SetOpt(HCurlEasy, CURLoption.URL, url); // Target URL

            DataCallbackCopier responseBuffer = new DataCallbackCopier(); // Buffer object for receiving the server response
            CurlNative.Easy.SetOpt(HCurlEasy, CURLoption.WRITEFUNCTION, responseBuffer.DataHandler);

            CurlNative.Easy.SetOpt(HCurlEasy, CURLoption.CAINFO, CurlResources.CaBundlePath); // Required for HTTPS

            // Make the request
            CURLcode ccPerform = CurlNative.Easy.Perform(HCurlEasy);
            if (ccPerform != CURLcode.OK)
            {
                throw new CurlHttpRequestFailedException(ccPerform, url);
            }

            byte[] response = responseBuffer.Stream.ToArray();
            responseBuffer.Dispose();

            return response;
        }

        public static string FetchResourceUtf8(string url)
        {
            return Encoding.UTF8.GetString(FetchResource(url));
        }


    }


    public class CurlHttpInitException : Exception
    {
        public CURLcode ErrorCode { get; private set; }

        public CurlHttpInitException(CURLcode errorCode)
        {
            ErrorCode = errorCode;
        }
    }

    public class CurlHttpRequestFailedException : Exception
    {
        public CURLcode ErrorCode { get; private set; }
        public string RequestUrl { get; private set; }

        public CurlHttpRequestFailedException(CURLcode errorCode, string requestUrl)
        {
            ErrorCode = errorCode;
            RequestUrl = requestUrl;
        }
    }
}

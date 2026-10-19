package io.github.lerc.sltd;

import android.content.res.AssetManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Serves APK assets as HTTPS responses; requests never fall through to a network. */
final class LocalContentClient extends WebViewClient {
    private final AssetManager assets;
    private final Runnable pageLoaded;
    private final Runnable exitRequested;

    LocalContentClient(AssetManager assets, Runnable pageLoaded, Runnable exitRequested) {
        this.assets = assets;
        this.pageLoaded = pageLoaded;
        this.exitRequested = exitRequested;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return shouldOverrideUrlLoading(view, request.getUrl().toString())
                || !"GET".equals(request.getMethod());
    }

    @Override
    @SuppressWarnings("deprecation")
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (AssetRequest.EXIT_URL.equals(url)) {
            exitRequested.run();
            return true;
        }
        return AssetRequest.assetPath(url) == null;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) {
            return error(405, "Method Not Allowed");
        }
        return load(request.getUrl().toString());
    }

    @Override
    @SuppressWarnings("deprecation")
    public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
        return load(url);
    }

    private WebResourceResponse load(String url) {
        String path = AssetRequest.assetPath(url);
        if (path == null) {
            return error(403, "Forbidden");
        }
        try {
            String mime = AssetRequest.mimeType(path);
            String encoding = mime.startsWith("text/") || mime.equals("application/json")
                    || mime.equals("image/svg+xml") ? "UTF-8" : null;
            return new WebResourceResponse(mime, encoding, 200, "OK", headers(),
                    assets.open(path, AssetManager.ACCESS_STREAMING));
        } catch (IOException exception) {
            return error(404, "Not Found");
        }
    }

    private static Map<String, String> headers() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("X-Content-Type-Options", "nosniff");
        return headers;
    }

    private static WebResourceResponse error(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, headers(),
                new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        if (AssetRequest.assetPath(url) != null) {
            pageLoaded.run();
        }
    }
}

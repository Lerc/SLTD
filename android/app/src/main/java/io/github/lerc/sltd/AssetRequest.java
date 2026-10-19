package io.github.lerc.sltd;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Maps only our fixed HTTPS origin to bundled assets, ignoring cache queries. */
final class AssetRequest {
    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/assets/web/index.html";
    /** Outside the bundled web directory, so it is never served; the host adapter navigates here to quit. */
    static final String EXIT_URL = "https://" + HOST + "/exit";

    private AssetRequest() {}

    static String assetPath(String url) {
        final URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException exception) {
            return null;
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())
                || !HOST.equalsIgnoreCase(uri.getHost())
                || uri.getRawUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443)) {
            return null;
        }

        String path = uri.getPath();
        if (path == null || !path.startsWith("/assets/web/")
                || path.indexOf('\\') >= 0 || path.indexOf('\0') >= 0) {
            return null;
        }
        for (String segment : path.substring(1).split("/", -1)) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")) {
                return null;
            }
        }
        return path.substring("/assets/".length());
    }

    static String mimeType(String path) {
        String extension = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (extension) {
            case "html": return "text/html";
            case "css": return "text/css";
            case "js": return "text/javascript";
            case "json": return "application/json";
            case "png": return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "gif": return "image/gif";
            case "svg": return "image/svg+xml";
            case "ico": return "image/x-icon";
            case "ogg": return "audio/ogg";
            case "mp3": return "audio/mpeg";
            case "wav": return "audio/wav";
            case "woff": return "font/woff";
            case "woff2": return "font/woff2";
            case "wasm": return "application/wasm";
            case "txt": return "text/plain";
            default: return "application/octet-stream";
        }
    }
}

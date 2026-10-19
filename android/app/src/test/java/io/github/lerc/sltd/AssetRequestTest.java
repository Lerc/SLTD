package io.github.lerc.sltd;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

public final class AssetRequestTest {
    @Test
    public void mapsIndexAndNestedAssetsWithoutCacheQueries() {
        assertEquals("web/index.html", AssetRequest.assetPath(AssetRequest.START_URL));
        assertEquals("web/images/creeps/Shieldbug.png", AssetRequest.assetPath(
                "https://appassets.androidplatform.net/assets/web/images/creeps/Shieldbug.png?v=123#x"));
        assertEquals("web/main.js", AssetRequest.assetPath(
                "https://appassets.androidplatform.net:443/assets/web/main.js"));
    }

    @Test
    public void deniesOtherOriginsAndAssetDirectories() {
        String[] urls = {
                "http://appassets.androidplatform.net/assets/web/index.html",
                "https://example.org/assets/web/index.html",
                "https://appassets.androidplatform.net.evil.org/assets/web/index.html",
                "https://user@appassets.androidplatform.net/assets/web/index.html",
                "https://appassets.androidplatform.net:8443/assets/web/index.html",
                "file:///android_asset/web/index.html",
                "content://example/index.html",
                "javascript:alert(1)",
                "https://appassets.androidplatform.net/assets/shell/host.js",
                "https://appassets.androidplatform.net/assets/legal/LICENSE",
                "https://appassets.androidplatform.net/assets/web/",
                "https://appassets.androidplatform.net/",
                "not a URL"
        };
        for (String url : urls) {
            assertNull(url, AssetRequest.assetPath(url));
        }
    }

    @Test
    public void deniesTraversalIncludingEncodedSegments() {
        String root = "https://appassets.androidplatform.net/assets/web/";
        String[] paths = {
                "../legal/LICENSE", "./index.html", "%2e%2e/legal/LICENSE",
                "images/%2e%2e/index.html", "images//x.png", "images%2f..%2findex.html",
                "images/%5c../index.html", "images/%00.png", "images\\x.png"
        };
        for (String path : paths) {
            assertNull(path, AssetRequest.assetPath(root + path));
        }
    }

    @Test
    public void usesExecutableAndBinaryMimeTypes() {
        assertEquals("text/javascript", AssetRequest.mimeType("web/main.js"));
        assertEquals("text/css", AssetRequest.mimeType("web/main.css"));
        assertEquals("text/html", AssetRequest.mimeType("web/index.html"));
        assertEquals("image/png", AssetRequest.mimeType("web/images/Tower1.PNG"));
        assertEquals("application/json", AssetRequest.mimeType("web/maps.json"));
        assertEquals("application/octet-stream", AssetRequest.mimeType("web/unknown"));
    }
}

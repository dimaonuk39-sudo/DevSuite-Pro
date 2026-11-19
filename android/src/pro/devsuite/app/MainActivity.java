package pro.devsuite.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.TextUtils;
import android.util.Base64;
import android.view.View;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPInputStream;
import java.util.zip.InflaterInputStream;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class MainActivity extends Activity {
    private static final int REQ_FILE = 1001;
    private static final int REQ_CAMERA = 1002;
    private static final int REQ_STORAGE = 1003;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingPermissionRequest;
    private final Map<String, HttpTask> httpTasks = new ConcurrentHashMap<>();
    private final AtomicInteger httpSeq = new AtomicInteger(1000);

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawableResource(android.R.color.black);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF07090F);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setLoadsImagesAutomatically(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(false);
        }

        webView.addJavascriptInterface(new Bridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri == null ? "" : String.valueOf(uri.getScheme()).toLowerCase();
                if ("file".equals(scheme) || "about".equals(scheme) || "data".equals(scheme) || "blob".equals(scheme)) {
                    return false;
                }
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    openExternalUrl(uri.toString());
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.setVisibility(View.VISIBLE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        boolean wantsVideo = false;
                        for (String resource : request.getResources()) {
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                                wantsVideo = true;
                                break;
                            }
                        }
                        if (!wantsVideo) {
                            request.deny();
                            return;
                        }
                        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.getResources());
                            return;
                        }
                        if (pendingPermissionRequest != null) {
                            try { pendingPermissionRequest.deny(); } catch (Exception ignored) {}
                        }
                        pendingPermissionRequest = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, REQ_FILE);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    toastOnUi("Не удалось открыть выбор файла");
                    return false;
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) dm.enqueue(request);
                    toastOnUi("Скачивание: " + name);
                } catch (Exception e) {
                    toastOnUi("Ошибка скачивания: " + e.getMessage());
                }
            }
        });

        if (Build.VERSION.SDK_INT <= 28 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
        }

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CAMERA && pendingPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
            } else {
                pendingPermissionRequest.deny();
            }
            pendingPermissionRequest = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null) {
                    results = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        results[i] = clip.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        for (HttpTask task : httpTasks.values()) task.abort();
        httpTasks.clear();
        if (webView != null) {
            try {
                webView.removeJavascriptInterface("Android");
                webView.destroy();
            } catch (Exception ignored) {}
            webView = null;
        }
        super.onDestroy();
    }

    private void openExternalUrl(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            toastOnUi("Нет приложения для открытия ссылки");
        }
    }

    private void toastOnUi(final String text) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, text, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void postHttpEvent(JSONObject event) {
        if (event == null) return;
        String payload = event.toString();
        payload = payload.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
        final String js = "window.__dsAndroidHttp && window.__dsAndroidHttp(" + JSONObject.quote(payload) + ");";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                WebView w = webView;
                if (w != null) {
                    try { w.evaluateJavascript(js, null); } catch (Exception ignored) {}
                }
            }
        });
    }

    private HttpURLConnection openConnection(String url, int timeout, boolean ignoreTls) throws Exception {
        URL parsed = new URL(url);
        String protocol = parsed.getProtocol().toLowerCase(Locale.US);
        if (!"http".equals(protocol) && !"https".equals(protocol)) {
            throw new Exception("Поддерживаются только http:// и https://");
        }
        HttpURLConnection connection = (HttpURLConnection) parsed.openConnection();
        connection.setConnectTimeout(Math.min(Math.max(timeout, 1000), 30000));
        connection.setReadTimeout(Math.max(timeout, 1000));
        connection.setInstanceFollowRedirects(true);
        connection.setUseCaches(false);
        if (ignoreTls && connection instanceof HttpsURLConnection) {
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, new TrustManager[]{new X509TrustManager() {
                @Override public void checkClientTrusted(X509Certificate[] chain, String authType) {}
                @Override public void checkServerTrusted(X509Certificate[] chain, String authType) {}
                @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            }}, new SecureRandom());
            HttpsURLConnection https = (HttpsURLConnection) connection;
            https.setSSLSocketFactory(context.getSocketFactory());
            https.setHostnameVerifier(new HostnameVerifier() {
                @Override public boolean verify(String hostname, SSLSession session) { return true; }
            });
        }
        return connection;
    }

    private class HttpTask implements Runnable {
        private final String id;
        private final JSONObject request;
        private volatile boolean aborted;
        private volatile HttpURLConnection connection;

        HttpTask(String id, JSONObject request) {
            this.id = id;
            this.request = request;
        }

        void abort() {
            aborted = true;
            HttpURLConnection c = connection;
            if (c != null) {
                try { c.disconnect(); } catch (Exception ignored) {}
            }
        }

        @Override
        public void run() {
            long started = System.currentTimeMillis();
            try {
                String url = request.optString("url", "");
                String method = request.optString("method", "GET").toUpperCase(Locale.US);
                int timeout = Math.max(1000, request.optInt("timeout", 60000));
                connection = openConnection(url, timeout, request.optBoolean("ignoreTls", false));
                connection.setRequestMethod(method);
                JSONObject headers = request.optJSONObject("headers");
                if (headers != null) {
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        if (key == null || key.isEmpty()) continue;
                        String value = headers.optString(key, "");
                        try { connection.setRequestProperty(key, value); } catch (Exception ignored) {}
                    }
                }
                if (connection.getRequestProperty("User-Agent") == null) {
                    connection.setRequestProperty("User-Agent", "DevSuitePro/1.0 (Android)");
                }
                if (connection.getRequestProperty("Accept-Encoding") == null) {
                    connection.setRequestProperty("Accept-Encoding", "gzip, deflate");
                }
                String bodyB64 = request.optString("bodyB64", "");
                if (!bodyB64.isEmpty() && !"GET".equals(method) && !"HEAD".equals(method)) {
                    byte[] body = Base64.decode(bodyB64, Base64.DEFAULT);
                    connection.setDoOutput(true);
                    connection.setFixedLengthStreamingMode(body.length);
                    OutputStream os = connection.getOutputStream();
                    try {
                        os.write(body);
                        os.flush();
                    } finally {
                        os.close();
                    }
                }
                if (aborted) {
                    emitError("Запрос отменён", true);
                    return;
                }
                int status = connection.getResponseCode();
                String statusText = connection.getResponseMessage();
                JSONObject responseHeaders = new JSONObject();
                Map<String, List<String>> rawHeaders = connection.getHeaderFields();
                for (Map.Entry<String, List<String>> entry : rawHeaders.entrySet()) {
                    String key = entry.getKey();
                    if (key == null) continue;
                    responseHeaders.put(key, TextUtils.join(", ", entry.getValue()));
                }
                JSONObject response = new JSONObject();
                response.put("id", id)
                        .put("type", "response")
                        .put("status", status)
                        .put("statusText", statusText == null ? "" : statusText)
                        .put("headers", responseHeaders)
                        .put("url", connection.getURL().toString());
                postHttpEvent(response);

                InputStream in = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (in == null) in = connection.getInputStream();
                String contentEncoding = connection.getContentEncoding();
                if (contentEncoding != null) {
                    String enc = contentEncoding.toLowerCase(Locale.US);
                    if (enc.contains("gzip")) {
                        in = new GZIPInputStream(in);
                    } else if (enc.contains("deflate")) {
                        in = new InflaterInputStream(in);
                    }
                }
                try {
                    byte[] buf = new byte[8192];
                    int n;
                    while (!aborted && (n = in.read(buf)) != -1) {
                        if (n == 0) continue;
                        byte[] chunk = new byte[n];
                        System.arraycopy(buf, 0, chunk, 0, n);
                        JSONObject event = new JSONObject();
                        event.put("id", id)
                                .put("type", "chunk")
                                .put("b64", Base64.encodeToString(chunk, Base64.NO_WRAP));
                        postHttpEvent(event);
                    }
                } finally {
                    try { in.close(); } catch (Exception ignored) {}
                }
                if (!aborted) {
                    JSONObject end = new JSONObject();
                    end.put("id", id)
                            .put("type", "end")
                            .put("time", System.currentTimeMillis() - started);
                    postHttpEvent(end);
                }
            } catch (Exception e) {
                if (!aborted) emitError(e.getMessage() == null ? e.toString() : e.getMessage(), false);
            } finally {
                httpTasks.remove(id);
                HttpURLConnection c = connection;
                if (c != null) {
                    try { c.disconnect(); } catch (Exception ignored) {}
                }
            }
        }

        private void emitError(String message, boolean wasAborted) {
            try {
                JSONObject event = new JSONObject();
                event.put("id", id)
                        .put("type", "error")
                        .put("message", message)
                        .put("aborted", wasAborted);
                postHttpEvent(event);
            } catch (Exception ignored) {}
        }
    }

    public class Bridge {
        @JavascriptInterface
        public boolean isAndroid() {
            return true;
        }

        @JavascriptInterface
        public String getVersion() {
            return "1.0.0";
        }

        @JavascriptInterface
        public String httpStart(String requestJson) {
            String id = "a" + httpSeq.incrementAndGet();
            try {
                JSONObject request = new JSONObject(requestJson);
                HttpTask task = new HttpTask(id, request);
                httpTasks.put(id, task);
                Thread thread = new Thread(task, "devsuite-http-" + id);
                thread.setDaemon(true);
                thread.start();
            } catch (Exception e) {
                try {
                    JSONObject event = new JSONObject();
                    event.put("id", id)
                            .put("type", "error")
                            .put("message", "Неверный запрос: " + e.getMessage());
                    postHttpEvent(event);
                } catch (Exception ignored) {}
            }
            return id;
        }

        @JavascriptInterface
        public void httpAbort(String id) {
            if (id == null) return;
            HttpTask task = httpTasks.get(id);
            if (task != null) task.abort();
        }

        @JavascriptInterface
        public void toast(String text) {
            toastOnUi(String.valueOf(text));
        }

        @JavascriptInterface
        public void openExternal(String url) {
            if (url == null) return;
            String lower = url.toLowerCase();
            if (lower.startsWith("http://") || lower.startsWith("https://")) {
                openExternalUrl(url);
            }
        }

        @JavascriptInterface
        public void saveFile(final String filename, final String mime, final String base64) {
            final String safeName = sanitizeFilename(filename);
            try {
                byte[] data = Base64.decode(base64 == null ? "" : base64, Base64.DEFAULT);
                String where;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    values.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new Exception("не удалось создать файл в Downloads");
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) throw new Exception("нет доступа к файлу");
                    try {
                        os.write(data);
                        os.flush();
                    } finally {
                        os.close();
                    }
                    values.clear();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, values, null, null);
                    where = "Downloads/" + safeName;
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) throw new Exception("Downloads недоступен");
                    if (!dir.exists()) dir.mkdirs();
                    File file = new File(dir, safeName);
                    String base = safeName;
                    String ext = "";
                    int dot = safeName.lastIndexOf('.');
                    if (dot > 0) {
                        base = safeName.substring(0, dot);
                        ext = safeName.substring(dot);
                    }
                    int index = 1;
                    while (file.exists()) {
                        file = new File(dir, base + " (" + index + ")" + ext);
                        index++;
                    }
                    FileOutputStream fos = new FileOutputStream(file);
                    try {
                        fos.write(data);
                        fos.flush();
                    } finally {
                        fos.close();
                    }
                    where = file.getAbsolutePath();
                }
                final String resultPath = where;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, "Сохранено: " + resultPath, Toast.LENGTH_LONG).show();
                    }
                });
            } catch (final Exception e) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, "Ошибка сохранения: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            }
        }
    }

    private String sanitizeFilename(String filename) {
        String name = filename == null ? "devsuite-output.bin" : filename;
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_").trim();
        if (name.isEmpty()) name = "devsuite-output.bin";
        if (name.length() > 120) {
            String ext = "";
            int dot = name.lastIndexOf('.');
            if (dot > 0 && name.length() - dot <= 10) ext = name.substring(dot);
            name = name.substring(0, 110) + ext;
        }
        return name;
    }
}

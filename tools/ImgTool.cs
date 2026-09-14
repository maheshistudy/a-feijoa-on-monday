using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Text;
using System.Globalization;

public class Comp {
    public int Area, MinX, MinY, MaxX, MaxY; public double SumX, SumY;
}

public static class ImgTool {

    // ---------- load / save ----------
    public static byte[] Load(string path, out int w, out int h) {
        using (var img = new Bitmap(path)) {
            w = img.Width; h = img.Height;
            using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                using (var g = Graphics.FromImage(bmp)) {
                    g.CompositingMode = CompositingMode.SourceCopy;
                    g.DrawImage(img, new Rectangle(0, 0, w, h), 0, 0, w, h, GraphicsUnit.Pixel);
                }
                var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                var buf = new byte[w * h * 4];
                Marshal.Copy(data.Scan0, buf, 0, buf.Length);
                bmp.UnlockBits(data);
                return buf;
            }
        }
    }

    static Bitmap ToBitmap(byte[] buf, int w, int h) {
        var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        Marshal.Copy(buf, 0, data.Scan0, buf.Length);
        bmp.UnlockBits(data);
        return bmp;
    }

    static Bitmap Scale(Bitmap src, int nw, int nh) {
        var dst = new Bitmap(nw, nh, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(dst)) {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.Half;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            using (var ia = new ImageAttributes()) {
                ia.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(src, new Rectangle(0, 0, nw, nh), 0, 0, src.Width, src.Height, GraphicsUnit.Pixel, ia);
            }
        }
        return dst;
    }

    static void SaveJpeg(Bitmap bmp, string path, int quality) {
        ImageCodecInfo codec = null;
        foreach (var c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") codec = c;
        var ep = new EncoderParameters(1);
        ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)quality);
        // flatten onto white for jpeg
        using (var flat = new Bitmap(bmp.Width, bmp.Height, PixelFormat.Format24bppRgb)) {
            using (var g = Graphics.FromImage(flat)) { g.Clear(Color.White); g.DrawImage(bmp, 0, 0); }
            flat.Save(path, codec, ep);
        }
    }

    public static string ResizeJpeg(string src, string dst, int nw, int nh, int quality) {
        using (var img = new Bitmap(src))
        using (var s = Scale(img, nw, nh)) { SaveJpeg(s, dst, quality); }
        return "{\"file\":\"" + System.IO.Path.GetFileName(dst) + "\",\"w\":" + nw + ",\"h\":" + nh + "}";
    }

    public static string CropResizePng(string src, string dst, int rx, int ry, int rw, int rh, int nw, int nh) {
        int w, h; var buf = Load(src, out w, out h);
        var crop = CropBuf(buf, w, h, rx, ry, rw, rh);
        using (var b = ToBitmap(crop, rw, rh))
        using (var s = Scale(b, nw, nh)) { s.Save(dst, ImageFormat.Png); }
        return "ok";
    }

    static byte[] CropBuf(byte[] buf, int w, int h, int rx, int ry, int rw, int rh) {
        var o = new byte[rw * rh * 4];
        for (int y = 0; y < rh; y++)
            Buffer.BlockCopy(buf, ((ry + y) * w + rx) * 4, o, y * rw * 4, rw * 4);
        return o;
    }

    // ---------- helpers ----------
    // optional second "background" colour (e.g. a branch that must stay in the background)
    public static int ExR = -1, ExG = -1, ExB = -1, ExTol = 0;
    public static int ClrX = 0, ClrY = 0, ClrW = 0, ClrH = 0;

    static int Dist(byte[] b, int i, int br, int bg, int bb) {
        int d = Math.Abs(b[i] - bb); int t = Math.Abs(b[i + 1] - bg); if (t > d) d = t;
        t = Math.Abs(b[i + 2] - br); if (t > d) d = t;
        if (b[i + 3] < 16) d = 0;   // already transparent
        if (ExTol > 0) {
            int e = Math.Abs(b[i] - ExB); t = Math.Abs(b[i + 1] - ExG); if (t > e) e = t;
            t = Math.Abs(b[i + 2] - ExR); if (t > e) e = t;
            if (e <= ExTol) d = 0;
        }
        return d;
    }

    // average colour of a small block around (x,y) inside the crop, per channel
    static int Sample(byte[] buf, int w, int h, int x, int y, int c) {
        long s = 0; int n = 0;
        for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
            int xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            s += buf[(yy * w + xx) * 4 + c]; n++;
        }
        return n == 0 ? 128 : (int)(s / n);
    }

    // flood from crop border over pixels with dist<=tolSoft. returns alpha array (0..255) for crop.
    static byte[] FloodAlpha(byte[] crop, int w, int h, int br, int bg, int bb, int tolHard, int tolSoft) {
        var alpha = new byte[w * h];
        for (int i = 0; i < alpha.Length; i++) alpha[i] = 255;
        var vis = new byte[w * h];
        var q = new int[w * h]; int qh = 0, qt = 0;
        Action<int> push = null;
        push = (p) => { if (vis[p] == 0 && Dist(crop, p * 4, br, bg, bb) <= tolSoft) { vis[p] = 1; q[qt++] = p; } };
        for (int x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
        for (int y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
        while (qh < qt) {
            int p = q[qh++]; int x = p % w, y = p / w;
            int d = Dist(crop, p * 4, br, bg, bb);
            int a = d <= tolHard ? 0 : (int)((d - tolHard) * 255L / Math.Max(1, tolSoft - tolHard));
            alpha[p] = (byte)Math.Min(255, a);
            if (x > 0) push(p - 1); if (x < w - 1) push(p + 1);
            if (y > 0) push(p - w); if (y < h - 1) push(p + w);
        }
        return alpha;
    }

    static List<Comp> Components(byte[] mask, int w, int h) {
        var list = new List<Comp>();
        var vis = new byte[w * h];
        var q = new int[w * h];
        for (int s = 0; s < w * h; s++) {
            if (mask[s] == 0 || vis[s] != 0) continue;
            var c = new Comp(); c.MinX = w; c.MinY = h; c.MaxX = -1; c.MaxY = -1;
            int qh = 0, qt = 0; q[qt++] = s; vis[s] = 1;
            while (qh < qt) {
                int p = q[qh++]; int x = p % w, y = p / w;
                c.Area++; c.SumX += x; c.SumY += y;
                if (x < c.MinX) c.MinX = x; if (x > c.MaxX) c.MaxX = x;
                if (y < c.MinY) c.MinY = y; if (y > c.MaxY) c.MaxY = y;
                int n;
                if (x > 0) { n = p - 1; if (mask[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
                if (x < w - 1) { n = p + 1; if (mask[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
                if (y > 0) { n = p - w; if (mask[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
                if (y < h - 1) { n = p + w; if (mask[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
            }
            list.Add(c);
        }
        return list;
    }

    static void RemoveSpecks(byte[] alpha, int w, int h, int minArea) {
        var m = new byte[w * h];
        for (int i = 0; i < m.Length; i++) m[i] = (byte)(alpha[i] >= 64 ? 1 : 0);
        var comps = Components(m, w, h);
        // mark small comps
        var vis = new byte[w * h]; var q = new int[w * h];
        foreach (var c in comps) {
            if (c.Area >= minArea) continue;
            // flood again from any pixel in bbox belonging to comp: simple approach — re-run BFS from first found
            for (int y = c.MinY; y <= c.MaxY; y++) for (int x = c.MinX; x <= c.MaxX; x++) {
                int s = y * w + x; if (m[s] == 0 || vis[s] != 0) continue;
                int qh = 0, qt = 0; q[qt++] = s; vis[s] = 1; var pts = new List<int>();
                while (qh < qt) {
                    int p = q[qh++]; pts.Add(p); int px = p % w, py = p / w; int n;
                    if (px > 0) { n = p - 1; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
                    if (px < w - 1) { n = p + 1; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
                    if (py > 0) { n = p - w; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
                    if (py < h - 1) { n = p + w; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; q[qt++] = n; } }
                }
                if (pts.Count < minArea) foreach (var p in pts) alpha[p] = 0;
            }
        }
    }

    static void Dilate(byte[] m, int w, int h, int r) {
        var t = new byte[w * h];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            byte v = 0; for (int k = -r; k <= r; k++) { int xx = x + k; if (xx >= 0 && xx < w && m[y * w + xx] != 0) { v = 1; break; } }
            t[y * w + x] = v;
        }
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            byte v = 0; for (int k = -r; k <= r; k++) { int yy = y + k; if (yy >= 0 && yy < h && t[yy * w + x] != 0) { v = 1; break; } }
            m[y * w + x] = v;
        }
    }

    // robust border colour: quantised mode of the border pixels, then mean of pixels near that mode
    static void BorderColor(byte[] crop, int w, int h, out int r, out int g, out int b) {
        var pts = new List<int>();
        for (int x = 0; x < w; x++) { pts.Add(x); pts.Add((h - 1) * w + x); }
        for (int y = 0; y < h; y++) { pts.Add(y * w); pts.Add(y * w + w - 1); }
        var hist = new Dictionary<int, int>();
        foreach (var p in pts) {
            int key = ((crop[p * 4 + 2] >> 4) << 8) | ((crop[p * 4 + 1] >> 4) << 4) | (crop[p * 4] >> 4);
            int c; hist.TryGetValue(key, out c); hist[key] = c + 1;
        }
        int bestKey = 0, bestN = -1;
        foreach (var kv in hist) if (kv.Value > bestN) { bestN = kv.Value; bestKey = kv.Key; }
        int mr = ((bestKey >> 8) & 15) * 16 + 8, mg = ((bestKey >> 4) & 15) * 16 + 8, mb = (bestKey & 15) * 16 + 8;
        long sr = 0, sg = 0, sb = 0, n = 0;
        foreach (var p in pts) {
            int pr = crop[p * 4 + 2], pg = crop[p * 4 + 1], pb = crop[p * 4];
            if (Math.Abs(pr - mr) <= 24 && Math.Abs(pg - mg) <= 24 && Math.Abs(pb - mb) <= 24) { sr += pr; sg += pg; sb += pb; n++; }
        }
        if (n == 0) { r = mr; g = mg; b = mb; return; }
        r = (int)(sr / n); g = (int)(sg / n); b = (int)(sb / n);
    }

    static string Bbox(byte[] alpha, int w, int h, int thresh, out int x0, out int y0, out int x1, out int y1) {
        x0 = w; y0 = h; x1 = -1; y1 = -1;
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (alpha[y * w + x] >= thresh) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        return x1 < 0 ? "empty" : "ok";
    }

    static void ApplyAlpha(byte[] crop, byte[] alpha) {
        for (int i = 0; i < alpha.Length; i++) crop[i * 4 + 3] = alpha[i];
    }

    static void SavePngScaled(byte[] crop, int w, int h, int x0, int y0, int cw, int ch, double scale, string dst) {
        var sub = CropBuf(crop, w, h, x0, y0, cw, ch);
        int nw = Math.Max(1, (int)Math.Round(cw * scale)), nh = Math.Max(1, (int)Math.Round(ch * scale));
        using (var b = ToBitmap(sub, cw, ch)) {
            if (Math.Abs(scale - 1.0) < 1e-6) b.Save(dst, ImageFormat.Png);
            else using (var s = Scale(b, nw, nh)) s.Save(dst, ImageFormat.Png);
        }
    }

    static string J(string file, int x, int y, int w, int h) {
        return "{\"file\":\"" + file + "\",\"x\":" + x + ",\"y\":" + y + ",\"w\":" + w + ",\"h\":" + h + "}";
    }

    // ---------- KeyCrop: key background (flood from border), crop to content bbox, save PNG ----------
    // bgMode: "white" | "auto"
    public static string KeyCrop(string src, string dst, int rx, int ry, int rw, int rh, string bgMode,
                                 int tolHard, int tolSoft, double scale, int pad, int minArea) {
        int w, h; var buf = Load(src, out w, out h);
        if (rw <= 0) { rx = 0; ry = 0; rw = w; rh = h; }
        var crop = CropBuf(buf, w, h, rx, ry, rw, rh);
        int br = 255, bg = 255, bb = 255;
        if (bgMode == "auto") BorderColor(crop, rw, rh, out br, out bg, out bb);
        var alpha = FloodAlpha(crop, rw, rh, br, bg, bb, tolHard, tolSoft);
        RemoveSpecks(alpha, rw, rh, minArea);
        int x0, y0, x1, y1;
        if (Bbox(alpha, rw, rh, 64, out x0, out y0, out x1, out y1) == "empty") return "{\"error\":\"empty\"}";
        x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad); x1 = Math.Min(rw - 1, x1 + pad); y1 = Math.Min(rh - 1, y1 + pad);
        ApplyAlpha(crop, alpha);
        int cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        SavePngScaled(crop, rw, rh, x0, y0, cw, ch, scale, dst);
        return J(System.IO.Path.GetFileName(dst), rx + x0, ry + y0, cw, ch);
    }

    // ---------- MaskCrop: build bite mask for a given bbox (orig coords) from full + hole layers ----------
    public static string MaskCrop(string fullSrc, string holeSrc, string dst, int bx, int by, int bw, int bh,
                                  int tolHard, int tolSoft, double scale, int minHoleArea) {
        int w, h; var full = Load(fullSrc, out w, out h);
        int w2, h2; var hole = Load(holeSrc, out w2, out h2);
        var fc = CropBuf(full, w, h, bx, by, bw, bh);
        var hc = CropBuf(hole, w2, h2, bx, by, bw, bh);
        var aF = FloodAlpha(fc, bw, bh, 255, 255, 255, tolHard, tolSoft);
        var aH = FloodAlpha(hc, bw, bh, 255, 255, 255, tolHard, tolSoft);
        var holeMask = new byte[bw * bh];
        for (int i = 0; i < holeMask.Length; i++) {
            int d = Dist(hc, i * 4, 255, 255, 255);
            if (d <= tolSoft && aF[i] >= 128) {
                int a = d <= tolHard ? 0 : (int)((d - tolHard) * 255L / Math.Max(1, tolSoft - tolHard));
                if (a < aH[i]) aH[i] = (byte)a;
                if (a < 128) holeMask[i] = 1;
            }
        }
        var comps = Components(holeMask, bw, bh);
        var sb = new StringBuilder();
        sb.Append("{\"file\":\"" + System.IO.Path.GetFileName(dst) + "\",\"holes\":[");
        bool first = true;
        comps.Sort((a, b) => (a.SumX / a.Area).CompareTo(b.SumX / b.Area));
        foreach (var c in comps) {
            if (c.Area < minHoleArea) continue;
            if (!first) sb.Append(","); first = false;
            double cx = c.SumX / c.Area / bw * 100.0, cy = c.SumY / c.Area / bh * 100.0;
            sb.Append("{\"cx\":" + cx.ToString("F1", CultureInfo.InvariantCulture) + ",\"cy\":" + cy.ToString("F1", CultureInfo.InvariantCulture) + ",\"area\":" + c.Area + "}");
        }
        sb.Append("]}");
        ApplyAlpha(hc, aH);
        SavePngScaled(hc, bw, bh, 0, 0, bw, bh, scale, dst);
        return sb.ToString();
    }

    // ---------- ExtractInpaint: pull an object out of a flat-ish background and fill the gap ----------
    // mode "auto": flood-key by crop border colour. mode "egg": near-white blob + dilated outline.
    public static string ExtractInpaint(string bgSrc, string spriteDst, string bgDst, int rx, int ry, int rw, int rh,
                                        string mode, int tolHard, int tolSoft, double scale, int pad,
                                        int outW, int outH, int quality) {
        int w, h; var buf = Load(bgSrc, out w, out h);
        var crop = CropBuf(buf, w, h, rx, ry, rw, rh);
        byte[] alpha;
        if (mode == "egg") {
            var m = new byte[rw * rh];
            for (int i = 0; i < m.Length; i++) m[i] = (byte)(Dist(crop, i * 4, 255, 255, 255) <= 70 ? 1 : 0);
            var comps = Components(m, rw, rh);
            Comp best = null; foreach (var c in comps) if (best == null || c.Area > best.Area) best = c;
            // keep only the largest component
            var keep = new byte[rw * rh];
            if (best != null) {
                var vis = new byte[rw * rh]; var q = new int[rw * rh];
                int s = best.MinY * rw + best.MinX;
                // find a start pixel of best comp
                for (int y = best.MinY; y <= best.MaxY && keep[s] == 0; y++) for (int x = best.MinX; x <= best.MaxX; x++) { int p = y * rw + x; if (m[p] != 0) { s = p; keep[s] = 1; break; } }
                int qh = 0, qt = 0; q[qt++] = s; vis[s] = 1; keep[s] = 1;
                while (qh < qt) { int p = q[qh++]; int px = p % rw, py = p / rw; int n;
                    if (px > 0) { n = p - 1; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; keep[n] = 1; q[qt++] = n; } }
                    if (px < rw - 1) { n = p + 1; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; keep[n] = 1; q[qt++] = n; } }
                    if (py > 0) { n = p - rw; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; keep[n] = 1; q[qt++] = n; } }
                    if (py < rh - 1) { n = p + rw; if (m[n] != 0 && vis[n] == 0) { vis[n] = 1; keep[n] = 1; q[qt++] = n; } }
                }
            }
            // fill enclosed holes (crack line) : anything not reachable from border through !keep
            var outside = FloodAlpha(ToRgbMask(keep, rw, rh), rw, rh, 0, 0, 0, 0, 0); // 0 where reachable
            for (int i = 0; i < keep.Length; i++) if (outside[i] != 0) keep[i] = 1;
            Dilate(keep, rw, rh, 9);
            alpha = new byte[rw * rh];
            for (int i = 0; i < alpha.Length; i++) alpha[i] = (byte)(keep[i] != 0 ? 255 : 0);
        } else {
            int br, bg, bb; BorderColor(crop, rw, rh, out br, out bg, out bb);
            alpha = FloodAlpha(crop, rw, rh, br, bg, bb, tolHard, tolSoft);
            RemoveSpecks(alpha, rw, rh, 150);
        }
        // optional crop-relative rectangle to force transparent (stray neighbours)
        if (ClrW > 0 && ClrH > 0)
            for (int y = Math.Max(0, ClrY); y < Math.Min(rh, ClrY + ClrH); y++)
                for (int x = Math.Max(0, ClrX); x < Math.Min(rw, ClrX + ClrW); x++) alpha[y * rw + x] = 0;
        int x0, y0, x1, y1;
        if (Bbox(alpha, rw, rh, 64, out x0, out y0, out x1, out y1) == "empty") return "{\"error\":\"empty\"}";
        x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad); x1 = Math.Min(rw - 1, x1 + pad); y1 = Math.Min(rh - 1, y1 + pad);
        var sprite = (byte[])crop.Clone();
        ApplyAlpha(sprite, alpha);
        int cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        SavePngScaled(sprite, rw, rh, x0, y0, cw, ch, scale, spriteDst);

        // inpaint: dilated mask, horizontal linear interpolation between nearest unmasked pixels
        var im = new byte[rw * rh];
        for (int i = 0; i < im.Length; i++) im[i] = (byte)(alpha[i] > 0 ? 1 : 0);
        Dilate(im, rw, rh, 4);
        for (int y = 0; y < rh; y++) {
            int x = 0;
            while (x < rw) {
                if (im[y * rw + x] == 0) { x++; continue; }
                int s = x; while (x < rw && im[y * rw + x] != 0) x++;
                int e = x - 1; // span s..e
                int li = s - 3, ri = e + 3;
                bool hasL = li >= 0, hasR = ri < rw;
                int[] lv = new int[3], rv = new int[3];
                for (int c = 0; c < 3; c++) {
                    lv[c] = hasL ? Sample(buf, w, h, rx + li, ry + y, c) : (hasR ? Sample(buf, w, h, rx + ri, ry + y, c) : 128);
                    rv[c] = hasR ? Sample(buf, w, h, rx + ri, ry + y, c) : lv[c];
                }
                for (int k = s; k <= e; k++) {
                    double t = (e == s) ? 0.5 : (double)(k - s) / (e - s + 1);
                    for (int c = 0; c < 3; c++) {
                        int gi = ((ry + y) * w + rx + k) * 4 + c;
                        buf[gi] = (byte)Math.Round(lv[c] * (1 - t) + rv[c] * t);
                    }
                }
            }
        }
        using (var b = ToBitmap(buf, w, h))
        using (var s = Scale(b, outW, outH)) SaveJpeg(s, bgDst, quality);
        return J(System.IO.Path.GetFileName(spriteDst), rx + x0, ry + y0, cw, ch);
    }

    // helper: build a fake BGRA buffer where mask=1 -> black (non-bg), mask=0 -> white(bg)
    static byte[] ToRgbMask(byte[] m, int w, int h) {
        var b = new byte[w * h * 4];
        for (int i = 0; i < m.Length; i++) { byte v = (byte)(m[i] != 0 ? 255 : 0); b[i * 4] = v; b[i * 4 + 1] = v; b[i * 4 + 2] = v; b[i * 4 + 3] = 255; }
        return b;
    }

    // ---------- Inpaint only (given rect: fill non-bg content) — used to erase baked objects ----------
    public static string InpaintOnly(string bgSrc, string bgDst, int rx, int ry, int rw, int rh, int tolHard, int tolSoft, int outW, int outH, int quality) {
        return ExtractInpaint(bgSrc, System.IO.Path.GetTempFileName() + ".png", bgDst, rx, ry, rw, rh, "auto", tolHard, tolSoft, 0.1, 0, outW, outH, quality);
    }

    public static string Md5(string path) {
        using (var md5 = System.Security.Cryptography.MD5.Create())
        using (var fs = System.IO.File.OpenRead(path)) {
            return BitConverter.ToString(md5.ComputeHash(fs)).Replace("-", "");
        }
    }
}

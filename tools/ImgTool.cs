// ImgTool.cs — the storybook's image pipeline primitives.
// Compiled on the fly by tools/build-assets.ps1 with Add-Type (System.Drawing, Windows only).
//
// Every operation reads the designer's 3508 x 2480 sheets and writes normalised copies.
// Nothing here generates artwork: it keys backgrounds, crops, measures, composites the
// designer's own layers, and detects word boxes on the typeset caption panels.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Text;
using System.Globalization;

public class Comp {
    public int Area, MinX, MinY, MaxX, MaxY; public double SumX, SumY; public List<int> Pts = new List<int>();
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

    // a flat single-colour background (used when the designer's page is a flat sky and the
    // objects on it must be lifted off so they can move)
    public static string FillJpeg(string dst, int r, int g, int b, int nw, int nh, int quality) {
        using (var bmp = new Bitmap(nw, nh, PixelFormat.Format24bppRgb)) {
            using (var gr = Graphics.FromImage(bmp)) gr.Clear(Color.FromArgb(r, g, b));
            SaveJpeg(bmp, dst, quality);
        }
        return "{\"file\":\"" + System.IO.Path.GetFileName(dst) + "\",\"w\":" + nw + ",\"h\":" + nh + ",\"rgb\":[" + r + "," + g + "," + b + "]}";
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
    static int DistRaw(byte[] b, int i, int r, int g, int bl) {
        int d = Math.Abs(b[i] - bl); int t = Math.Abs(b[i + 1] - g); if (t > d) d = t;
        t = Math.Abs(b[i + 2] - r); if (t > d) d = t;
        return d;
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

    static List<Comp> Components(byte[] mask, int w, int h, bool keepPts) {
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
                if (keepPts) c.Pts.Add(p);
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
        foreach (var c in Components(m, w, h, true))
            if (c.Area < minArea) foreach (var p in c.Pts) alpha[p] = 0;
    }

    static void Dilate(byte[] m, int w, int h, int r) {
        if (r <= 0) return;
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

    // robust dominant colour of a set of pixels: quantised mode, then mean of pixels near that mode
    static void ModeColor(byte[] buf, List<int> pts, out int r, out int g, out int b) {
        var hist = new Dictionary<int, int>();
        foreach (var p in pts) {
            int key = ((buf[p * 4 + 2] >> 4) << 8) | ((buf[p * 4 + 1] >> 4) << 4) | (buf[p * 4] >> 4);
            int c; hist.TryGetValue(key, out c); hist[key] = c + 1;
        }
        int bestKey = 0, bestN = -1;
        foreach (var kv in hist) if (kv.Value > bestN) { bestN = kv.Value; bestKey = kv.Key; }
        int mr = ((bestKey >> 8) & 15) * 16 + 8, mg = ((bestKey >> 4) & 15) * 16 + 8, mb = (bestKey & 15) * 16 + 8;
        long sr = 0, sg = 0, sb = 0, n = 0;
        foreach (var p in pts) {
            int pr = buf[p * 4 + 2], pg = buf[p * 4 + 1], pb = buf[p * 4];
            if (Math.Abs(pr - mr) <= 24 && Math.Abs(pg - mg) <= 24 && Math.Abs(pb - mb) <= 24) { sr += pr; sg += pg; sb += pb; n++; }
        }
        if (n == 0) { r = mr; g = mg; b = mb; return; }
        r = (int)(sr / n); g = (int)(sg / n); b = (int)(sb / n);
    }

    static void BorderColor(byte[] crop, int w, int h, out int r, out int g, out int b) {
        var pts = new List<int>();
        for (int x = 0; x < w; x++) { pts.Add(x); pts.Add((h - 1) * w + x); }
        for (int y = 0; y < h; y++) { pts.Add(y * w); pts.Add(y * w + w - 1); }
        ModeColor(crop, pts, out r, out g, out b);
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

    // save the pixels of `buf` where alpha>=64, cropped + padded, and return the sheet rectangle
    static string SaveSprite(byte[] buf, int w, int h, byte[] alpha, int rx, int ry, double scale, int pad, string dst) {
        int x0, y0, x1, y1;
        if (Bbox(alpha, w, h, 64, out x0, out y0, out x1, out y1) == "empty") return "{\"error\":\"empty\",\"file\":\"" + System.IO.Path.GetFileName(dst) + "\"}";
        x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad); x1 = Math.Min(w - 1, x1 + pad); y1 = Math.Min(h - 1, y1 + pad);
        var o = (byte[])buf.Clone();
        ApplyAlpha(o, alpha);
        int cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        SavePngScaled(o, w, h, x0, y0, cw, ch, scale, dst);
        return J(System.IO.Path.GetFileName(dst), rx + x0, ry + y0, cw, ch);
    }

    // ---------- KeyCrop: key background (flood from border), crop to content bbox, save PNG ----------
    // bgMode: "white" | "auto" (auto samples the crop border's dominant colour)
    public static string KeyCrop(string src, string dst, int rx, int ry, int rw, int rh, string bgMode,
                                 int tolHard, int tolSoft, double scale, int pad, int minArea) {
        int w, h; var buf = Load(src, out w, out h);
        if (rw <= 0) { rx = 0; ry = 0; rw = w; rh = h; }
        var crop = CropBuf(buf, w, h, rx, ry, rw, rh);
        int br = 255, bg = 255, bb = 255;
        if (bgMode == "auto") BorderColor(crop, rw, rh, out br, out bg, out bb);
        var alpha = FloodAlpha(crop, rw, rh, br, bg, bb, tolHard, tolSoft);
        RemoveSpecks(alpha, rw, rh, minArea);
        return SaveSprite(crop, rw, rh, alpha, rx, ry, scale, pad, dst);
    }

    // ---------- MaskCrop: build bite mask for a given bbox (sheet coords) from full + hole layers ----------
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
        var comps = Components(holeMask, bw, bh, false);
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

    // ---------- FlatCheck: is the sheet a flat colour outside a rectangle? ----------
    // Reports the dominant colour, the fraction of pixels further than tol from it, and the max distance.
    public static string FlatCheck(string src, int ex, int ey, int ew, int eh, int tol) {
        int w, h; var buf = Load(src, out w, out h);
        var pts = new List<int>();
        for (int y = 0; y < h; y += 4) for (int x = 0; x < w; x += 4) {
            if (x >= ex && x < ex + ew && y >= ey && y < ey + eh) continue;
            pts.Add(y * w + x);
        }
        int r, g, b; ModeColor(buf, pts, out r, out g, out b);
        long off = 0; int max = 0;
        foreach (var p in pts) { int d = DistRaw(buf, p * 4, r, g, b); if (d > tol) off++; if (d > max) max = d; }
        return "{\"r\":" + r + ",\"g\":" + g + ",\"b\":" + b + ",\"off\":" + ((double)off / pts.Count).ToString("F4", CultureInfo.InvariantCulture) + ",\"max\":" + max + ",\"flat\":" + (((double)off / pts.Count) < 0.002 ? "true" : "false") + "}";
    }

    // ---------- SplitByColor: separate a keyed sheet into "the branch" and "everything else" ----------
    // The branch is every pixel near (cr,cg,cb) belonging to a component that touches the sheet edge
    // (a branch always runs off the page; the cocoon's own dark strokes never do). The cocoon sprite is
    // the rest, with the branch (dilated by `dil`) cleared so no dark halo is left behind.
    public static string SplitByColor(string src, string dstMain, string dstColor, string bgMode, int tolHard, int tolSoft,
                                      int cr, int cg, int cb, int cTol, int dil, double scale, int pad, int minArea) {
        int w, h; var buf = Load(src, out w, out h);
        int br = 255, bg = 255, bb = 255;
        if (bgMode == "auto") BorderColor(buf, w, h, out br, out bg, out bb);
        var alpha = FloodAlpha(buf, w, h, br, bg, bb, tolHard, tolSoft);
        RemoveSpecks(alpha, w, h, minArea);
        var near = new byte[w * h];
        for (int i = 0; i < near.Length; i++) near[i] = (byte)(alpha[i] > 0 && DistRaw(buf, i * 4, cr, cg, cb) <= cTol ? 1 : 0);
        var branch = new byte[w * h];
        foreach (var c in Components(near, w, h, true)) {
            bool edge = c.MinX == 0 || c.MinY == 0 || c.MaxX == w - 1 || c.MaxY == h - 1;
            if (!edge) continue;
            foreach (var p in c.Pts) branch[p] = 1;
        }
        // branch sprite: near-colour pixels plus a 1px rim of soft edge
        var rim = (byte[])branch.Clone(); Dilate(rim, w, h, 1);
        var aBranch = new byte[w * h];
        for (int i = 0; i < aBranch.Length; i++) aBranch[i] = rim[i] != 0 ? alpha[i] : (byte)0;
        // main sprite: everything keyed, minus the dilated branch
        var cut = (byte[])branch.Clone(); Dilate(cut, w, h, dil);
        var aMain = new byte[w * h];
        for (int i = 0; i < aMain.Length; i++) aMain[i] = cut[i] != 0 ? (byte)0 : alpha[i];
        RemoveSpecks(aMain, w, h, minArea);
        string jm = SaveSprite(buf, w, h, aMain, 0, 0, scale, pad, dstMain);
        string jc = SaveSprite(buf, w, h, aBranch, 0, 0, scale, pad, dstColor);
        return "{\"main\":" + jm + ",\"color\":" + jc + "}";
    }

    // ---------- BiteComposite: the bitten leaf, backed with sky where the bite exposes the original leaf ----------
    // The whole leaf lives in the background (still). The bitten leaf comes on its own white sheet. Overlaying
    // the bitten leaf alone would still show the original leaf through the bite, so inside the hole rectangle
    // every background pixel that is not sky and not covered by the bitten leaf is painted with the sky colour
    // sampled from the still's border. One opacity fade of the resulting sprite then produces the bite.
    public static string BiteComposite(string stillSrc, string biteSrc, string dst, int hx, int hy, int hw, int hh,
                                       int tolHard, int tolSoft, int dil, double scale, int pad) {
        int w, h; var still = Load(stillSrc, out w, out h);
        int w2, h2; var bite = Load(biteSrc, out w2, out h2);
        if (w2 != w || h2 != h) return "{\"error\":\"size mismatch\"}";
        int sr, sg, sb; BorderColor(still, w, h, out sr, out sg, out sb);
        var aB = FloodAlpha(bite, w, h, 255, 255, 255, tolHard, tolSoft);
        RemoveSpecks(aB, w, h, 200);
        var hole = new byte[w * h];
        for (int y = Math.Max(0, hy); y < Math.Min(h, hy + hh); y++)
            for (int x = Math.Max(0, hx); x < Math.Min(w, hx + hw); x++) {
                int i = y * w + x;
                if (aB[i] < 255 && DistRaw(still, i * 4, sr, sg, sb) > tolSoft) hole[i] = 1;
            }
        Dilate(hole, w, h, dil);
        var o = (byte[])bite.Clone();
        var alpha = new byte[w * h];
        long uncovered = 0;
        for (int i = 0; i < alpha.Length; i++) {
            if (hole[i] != 0) {
                double a = aB[i] / 255.0;
                o[i * 4]     = (byte)Math.Round(bite[i * 4] * a + sb * (1 - a));
                o[i * 4 + 1] = (byte)Math.Round(bite[i * 4 + 1] * a + sg * (1 - a));
                o[i * 4 + 2] = (byte)Math.Round(bite[i * 4 + 2] * a + sr * (1 - a));
                alpha[i] = 255;
            } else alpha[i] = aB[i];
        }
        // how much of the still's non-sky content inside the hole rect is still visible around the sprite
        for (int y = Math.Max(0, hy); y < Math.Min(h, hy + hh); y++)
            for (int x = Math.Max(0, hx); x < Math.Min(w, hx + hw); x++) {
                int i = y * w + x;
                if (alpha[i] < 128 && DistRaw(still, i * 4, sr, sg, sb) > tolSoft) uncovered++;
            }
        string j = SaveSprite(o, w, h, alpha, 0, 0, scale, pad, dst);
        return j.Substring(0, j.Length - 1) + ",\"sky\":[" + sr + "," + sg + "," + sb + "],\"uncovered\":" + uncovered + "}";
    }

    // ---------- TextPanel: lift the typeset text off its cream band ----------
    // A global colour key, not a border flood, so the enclosed counters of "o" and "e" clear too.
    // The result is cropped to the ink's bounding box, so the panel can be placed as a block of
    // text wherever the page wants it rather than where the band happened to sit.
    public static string TextPanel(string src, string dst, int rx, int ry, int rw, int rh,
                                   int tolHard, int tolSoft, double scale, int pad) {
        int w, h; var buf = Load(src, out w, out h);
        var crop = CropBuf(buf, w, h, rx, ry, rw, rh);
        var all = new List<int>(); for (int i = 0; i < rw * rh; i += 3) all.Add(i);
        int cr, cg, cb; ModeColor(crop, all, out cr, out cg, out cb);
        // Ink is whatever is DARKER than the band. Keying on plain colour distance would also
        // catch the white sheet around the band, which is just as far from cream as the ink is.
        int bandLum = (cr * 30 + cg * 59 + cb * 11) / 100;
        var alpha = new byte[rw * rh];
        for (int i = 0; i < alpha.Length; i++) {
            int lum = (crop[i * 4 + 2] * 30 + crop[i * 4 + 1] * 59 + crop[i * 4] * 11) / 100;
            int d = bandLum - lum;
            alpha[i] = (byte)(d <= tolHard ? 0 : (d >= tolSoft ? 255 : (d - tolHard) * 255 / Math.Max(1, tolSoft - tolHard)));
        }
        RemoveSpecks(alpha, rw, rh, 30);
        string j = SaveSprite(crop, rw, rh, alpha, rx, ry, scale, pad, dst);
        return j.Substring(0, j.Length - 1) + ",\"band\":[" + cr + "," + cg + "," + cb + "]}";
    }

    // ---------- WordBoxes: detect the word boxes on a typeset caption band ----------
    // The crop (rx,ry,rw,rh) is the cream band. Ink = pixels further than inkTol from the band colour.
    // Lines come from the horizontal projection; words from the vertical projection per line, splitting on
    // gaps wider than gapFrac x the median line height. Tiny fragments (punctuation, dots) join the
    // preceding word. Boxes are returned as percentages of the band, in reading order, and optionally
    // drawn on a half-size debug image.
    public static string WordBoxes(string src, int rx, int ry, int rw, int rh, int inkTol, double gapFrac, string debugDst) {
        int w, h; var buf = Load(src, out w, out h);
        var crop = CropBuf(buf, w, h, rx, ry, rw, rh);
        var all = new List<int>(); for (int i = 0; i < rw * rh; i += 3) all.Add(i);
        int cr, cg, cb; ModeColor(crop, all, out cr, out cg, out cb);
        var ink = new byte[rw * rh];
        for (int i = 0; i < ink.Length; i++) ink[i] = (byte)(DistRaw(crop, i * 4, cr, cg, cb) > inkTol ? 1 : 0);
        // ---- lines ----
        // Tight leading means one line's descenders share rows with the next line's ascenders, so the
        // projection never reaches zero between lines. Lines are therefore the dense "cores" (rows with
        // more than a small fraction of the peak ink); each core is then extended outward over the
        // sparse rows for the box, stopping halfway to the neighbouring core.
        var rowInk = new int[rh];
        int maxRow = 0;
        for (int y = 0; y < rh; y++) { int n = 0; for (int x = 0; x < rw; x++) n += ink[y * rw + x]; rowInk[y] = n; if (n > maxRow) maxRow = n; }
        var sm = new double[rh];
        for (int y = 0; y < rh; y++) { double s = 0; int n = 0; for (int k = -2; k <= 2; k++) { int yy = y + k; if (yy >= 0 && yy < rh) { s += rowInk[yy]; n++; } } sm[y] = s / n; }
        // every line has one dense hump (its x-height band); find the humps, then the valleys between them
        var peaks = new List<int>();
        for (int y = 0; y < rh; y++) {
            if (sm[y] < maxRow * 0.06) continue;
            bool isPeak = true;
            for (int k = -3; k <= 3; k++) { int yy = y + k; if (yy >= 0 && yy < rh && yy != y && sm[yy] > sm[y]) { isPeak = false; break; } }
            if (isPeak) peaks.Add(y);
        }
        // a serif face has two sub-peaks per line (x-height serifs, baseline serifs) with a shallow dip
        // between them; a real line break drops to near zero. Merge peaks whose valley stays high.
        bool changed = true;
        while (changed && peaks.Count > 1) {
            changed = false;
            for (int i = 0; i + 1 < peaks.Count; i++) {
                double valley = double.MaxValue; for (int y = peaks[i]; y <= peaks[i + 1]; y++) if (sm[y] < valley) valley = sm[y];
                double lower = Math.Min(sm[peaks[i]], sm[peaks[i + 1]]);
                if (valley >= lower * 0.35) { if (sm[peaks[i]] >= sm[peaks[i + 1]]) peaks.RemoveAt(i + 1); else peaks.RemoveAt(i); changed = true; break; }
            }
        }
        // line boxes: from valley to valley, trimmed to rows that carry ink; core rows: dense rows of that line
        var lines = new List<int[]>();
        for (int i = 0; i < peaks.Count; i++) {
            int top = 0, bot = rh - 1;
            if (i > 0) { int best = peaks[i - 1]; for (int y = peaks[i - 1]; y <= peaks[i]; y++) if (sm[y] < sm[best]) best = y; top = best; }
            if (i + 1 < peaks.Count) { int best = peaks[i]; for (int y = peaks[i]; y <= peaks[i + 1]; y++) if (sm[y] < sm[best]) best = y; bot = best; }
            while (top < peaks[i] && rowInk[top] == 0) top++;
            while (bot > peaks[i] && rowInk[bot] == 0) bot--;
            double coreT = Math.Max(2, sm[peaks[i]] * 0.12);
            int c0 = peaks[i], c1 = peaks[i];
            while (c0 > top && rowInk[c0 - 1] >= coreT) c0--;
            while (c1 < bot && rowInk[c1 + 1] >= coreT) c1++;
            lines.Add(new int[] { top, bot, c0, c1 });
        }
        var heights = new List<int>(); foreach (var l in lines) heights.Add(l[3] - l[2] + 1);
        heights.Sort(); int medH = heights.Count > 0 ? heights[heights.Count / 2] : 1;
        // the line height used for gap decisions is the core (x-height + ascenders), the most stable measure
        int lineH = medH;
        double gapPx = gapFrac * lineH;
        // ---- words ----
        var words = new List<int[]>();   // x0,y0,x1,y1 in crop px
        var gapsAll = new List<int>();
        foreach (var l in lines) {
            int y0 = l[0], y1 = l[1], c0 = l[2], c1 = l[3];
            // column projection over the core rows only, so a neighbour's descenders can't bridge a word gap
            var colInk = new int[rw];
            var colTop = new int[rw]; var colBot = new int[rw];
            for (int x = 0; x < rw; x++) { colTop[x] = -1; colBot[x] = -1; }
            for (int y = c0; y <= c1; y++) for (int x = 0; x < rw; x++) if (ink[y * rw + x] != 0) {
                colInk[x]++; if (colTop[x] < 0) colTop[x] = y; colBot[x] = y;
            }
            var runs = new List<int[]>();
            int xs = -1;
            for (int x = 0; x <= rw; x++) {
                bool on = x < rw && colInk[x] > 0;
                if (on && xs < 0) xs = x;
                if (!on && xs >= 0) { runs.Add(new int[] { xs, x - 1 }); xs = -1; }
            }
            // group runs into words
            var groups = new List<List<int[]>>();
            for (int i = 0; i < runs.Count; i++) {
                if (i > 0) gapsAll.Add(runs[i][0] - runs[i - 1][1] - 1);
                if (i == 0 || runs[i][0] - runs[i - 1][1] - 1 > gapPx) groups.Add(new List<int[]>());
                groups[groups.Count - 1].Add(runs[i]);
            }
            // attach tiny fragments (dots, commas) to the previous word
            var boxes = new List<int[]>();
            foreach (var g in groups) {
                int gx0 = g[0][0], gx1 = g[g.Count - 1][1];
                int top = int.MaxValue, bot = -1;
                for (int x = gx0; x <= gx1; x++) if (colTop[x] >= 0) { if (colTop[x] < top) top = colTop[x]; if (colBot[x] > bot) bot = colBot[x]; }
                int inkH = bot - top + 1;
                if (boxes.Count > 0 && inkH < lineH * 0.3) boxes[boxes.Count - 1][2] = gx1;
                else boxes.Add(new int[] { gx0, y0, gx1, y1 });
            }
            words.AddRange(boxes);
        }
        // ---- emit ----
        var sbj = new StringBuilder();
        sbj.Append("{\"lines\":" + lines.Count + ",\"lineH\":" + lineH + ",\"gapPx\":" + gapPx.ToString("F1", CultureInfo.InvariantCulture) + ",\"band\":[" + cr + "," + cg + "," + cb + "],\"words\":[");
        int padX = Math.Max(2, lineH / 12), padY = Math.Max(2, lineH / 14);
        for (int i = 0; i < words.Count; i++) {
            var b = words[i];
            double x0 = Math.Max(0, b[0] - padX), y0 = Math.Max(0, b[1] - padY);
            double x1 = Math.Min(rw - 1, b[2] + padX), y1 = Math.Min(rh - 1, b[3] + padY);
            if (i > 0) sbj.Append(",");
            sbj.Append("[" + (x0 / rw * 100).ToString("F2", CultureInfo.InvariantCulture) + "," + (y0 / rh * 100).ToString("F2", CultureInfo.InvariantCulture) + ","
                       + ((x1 - x0 + 1) / rw * 100).ToString("F2", CultureInfo.InvariantCulture) + "," + ((y1 - y0 + 1) / rh * 100).ToString("F2", CultureInfo.InvariantCulture) + "]");
        }
        gapsAll.Sort();
        sbj.Append("],\"gaps\":[");
        for (int i = 0; i < gapsAll.Count; i++) { if (i > 0) sbj.Append(","); sbj.Append(gapsAll[i]); }
        sbj.Append("]}");
        if (!string.IsNullOrEmpty(debugDst)) {
            using (var bmp = ToBitmap(crop, rw, rh)) {
                using (var g = Graphics.FromImage(bmp)) using (var pen = new Pen(Color.FromArgb(200, 220, 40, 40), 3)) {
                    foreach (var b in words) g.DrawRectangle(pen, b[0] - padX, b[1] - padY, b[2] - b[0] + 2 * padX, b[3] - b[1] + 2 * padY);
                }
                using (var s = Scale(bmp, rw / 2, rh / 2)) s.Save(debugDst, ImageFormat.Png);
            }
        }
        return sbj.ToString();
    }

    public static string Md5(string path) {
        using (var md5 = System.Security.Cryptography.MD5.Create())
        using (var fs = System.IO.File.OpenRead(path)) {
            return BitConverter.ToString(md5.ComputeHash(fs)).Replace("-", "");
        }
    }
}

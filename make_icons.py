from PIL import Image, ImageDraw
import os

S = 1024
SS = 2
W = S * SS
img = Image.new("RGBA", (W, W), (0, 0, 0, 0))

# diagonal gradient background
grad = Image.new("RGBA", (W, W))
gd = grad.load()
c1 = (124, 92, 255)
c2 = (34, 211, 238)
c3 = (15, 19, 32)
for y in range(W):
    for x in range(W):
        t = (x / W * 0.55 + y / W * 0.45)
        if t < 0.58:
            k = t / 0.58
            r = int(c1[0] + (c2[0] - c1[0]) * k)
            g = int(c1[1] + (c2[1] - c1[1]) * k)
            b = int(c1[2] + (c2[2] - c1[2]) * k)
        else:
            k = (t - 0.58) / 0.42
            r = int(c2[0] + (c3[0] - c2[0]) * k)
            g = int(c2[1] + (c3[1] - c2[1]) * k)
            b = int(c2[2] + (c3[2] - c2[2]) * k)
        gd[x, y] = (r, g, b, 255)

mask = Image.new("L", (W, W), 0)
md = ImageDraw.Draw(mask)
pad = 28 * SS
rad = 224 * SS
md.rounded_rectangle([pad, pad, W - pad, W - pad], radius=rad, fill=255)
img.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(img)

# subtle inner dark plate
plate = Image.new("RGBA", (W, W), (0, 0, 0, 0))
pd = ImageDraw.Draw(plate)
pd.rounded_rectangle([92 * SS, 92 * SS, W - 92 * SS, W - 92 * SS], radius=170 * SS, fill=(9, 12, 22, 88))
img = Image.alpha_composite(img, plate)
d = ImageDraw.Draw(img)

# glow ring
d.rounded_rectangle([62 * SS, 62 * SS, W - 62 * SS, W - 62 * SS], radius=196 * SS, outline=(255, 255, 255, 26), width=2 * SS)

lw = 66 * SS
white = (255, 255, 255, 255)
cyan = (214, 247, 255, 255)

# left chevron
d.line([(402 * SS, 326 * SS), (286 * SS, 512 * SS), (402 * SS, 698 * SS)], fill=white, width=lw, joint="curve")
# right chevron
d.line([(622 * SS, 326 * SS), (738 * SS, 512 * SS), (622 * SS, 698 * SS)], fill=cyan, width=lw, joint="curve")
# slash
d.line([(582 * SS, 278 * SS), (442 * SS, 746 * SS)], fill=white, width=lw)
for p in [(402 * SS, 326 * SS), (286 * SS, 512 * SS), (402 * SS, 698 * SS),
          (622 * SS, 326 * SS), (738 * SS, 512 * SS), (622 * SS, 698 * SS),
          (582 * SS, 278 * SS), (442 * SS, 746 * SS)]:
    r = lw // 2
    d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=white if p[0] < 650 or p[1] < 400 else cyan)

# small accent dot bottom-right
d.ellipse([712 * SS, 712 * SS, 792 * SS, 792 * SS], fill=(34, 211, 238, 255))
d.ellipse([728 * SS, 728 * SS, 776 * SS, 776 * SS], fill=(9, 12, 22, 255))

img = img.resize((S, S), Image.LANCZOS)

os.makedirs("build", exist_ok=True)
os.makedirs("app/img", exist_ok=True)
os.makedirs("android/res/mipmap-mdpi", exist_ok=True)
os.makedirs("android/res/mipmap-hdpi", exist_ok=True)
os.makedirs("android/res/mipmap-xhdpi", exist_ok=True)
os.makedirs("android/res/mipmap-xxhdpi", exist_ok=True)
os.makedirs("android/res/mipmap-xxxhdpi", exist_ok=True)

img.save("build/icon.png")
img.save("app/img/icon.png")
img.save("app/img/logo.png")
img.save("build/icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
for name, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(f"android/res/mipmap-{name}/ic_launcher.png")
    # adaptive foreground: same image padded
    fg = Image.new("RGBA", (int(size * 1.5), int(size * 1.5)), (0, 0, 0, 0))
    fg.paste(resized, (size // 4, size // 4), resized)
    fg.save(f"android/res/mipmap-{name}/ic_launcher_foreground.png")

# splash
img.resize((512, 512), Image.LANCZOS).save("app/img/splash.png")
print("icons generated")

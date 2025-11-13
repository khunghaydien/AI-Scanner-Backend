#!/usr/bin/env python3
"""
Image Scanner using OpenCV
Enhanced version: cleaner, flatter, and more realistic scan effect.
"""

import sys
import os
import cv2
import numpy as np
from PIL import Image
import img2pdf


def scan_image(input_path: str, output_path: str) -> None:
    """
    Process image to create a scanned document effect and place it in A4 PDF frame.
    
    Args:
        input_path: Path to input image
        output_path: Path to save scanned PDF (must be .pdf)
    """
    try:
        # === Read and check image ===
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not read image from {input_path}")

        # === Convert to grayscale ===
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # === Normalize background (flatten uneven lighting) ===
        bg = cv2.medianBlur(gray, 21)
        normalized = cv2.divide(gray, bg, scale=255)

        # === Denoise to remove grain and small dots ===
        denoised = cv2.fastNlMeansDenoising(normalized, None, h=15, templateWindowSize=7, searchWindowSize=21)

        # === Slight blur to smooth edges ===
        blurred = cv2.GaussianBlur(denoised, (5, 5), 0)

        # === Adaptive threshold to create clean binary (black-white) image ===
        thresh = cv2.adaptiveThreshold(
            blurred,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2
        )

        # === Morphological cleaning: remove small noise, strengthen text ===
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        opened = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_open, iterations=1)

        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel_close, iterations=1)

        # # === Remove small specks (tiny black dots) ===

        # === Convert to PIL image for PDF generation ===
        pil_image = Image.fromarray(cleaned)

        # === Prepare A4 page parameters ===
        a4_width_mm, a4_height_mm = 210, 297
        dpi = 300
        a4_width_px = int((a4_width_mm / 25.4) * dpi)
        a4_height_px = int((a4_height_mm / 25.4) * dpi)
        a4_layout = (img2pdf.mm_to_pt(a4_width_mm), img2pdf.mm_to_pt(a4_height_mm))

        # === Create white A4 background ===
        a4_background = Image.new('RGB', (a4_width_px, a4_height_px), color='white')

        # Ensure the scanned image is RGB
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')

        img_width, img_height = pil_image.size

        # === Center image on A4 (keep original size, may crop edges if too large) ===
        x_offset_px = max(0, (a4_width_px - img_width) // 2)
        y_offset_px = max(0, (a4_height_px - img_height) // 2)
        a4_background.paste(pil_image, (x_offset_px, y_offset_px))

        # === Save temporary PNG ===
        temp_a4_path = os.path.join(os.path.dirname(output_path), f"temp_a4_{os.getpid()}.png")
        a4_background.save(temp_a4_path, 'PNG', dpi=(dpi, dpi))

        # === Convert to PDF with A4 layout ===
        with open(output_path, 'wb') as f:
            f.write(img2pdf.convert(temp_a4_path, layout_fun=img2pdf.get_layout_fun(a4_layout)))

        # === Cleanup ===
        if os.path.exists(temp_a4_path):
            os.unlink(temp_a4_path)

        print(f"✅ Successfully scanned and cleaned image → PDF A4: {output_path}", file=sys.stdout)

    except Exception as e:
        print(f"❌ Error scanning image: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 scan_image.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    scan_image(input_path, output_path)

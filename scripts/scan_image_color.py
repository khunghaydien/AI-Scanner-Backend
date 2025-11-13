#!/usr/bin/env python3
"""
Color Image Scanner using OpenCV
Scans image while preserving colors (not converting to black & white).
Places the image in A4 PDF frame with white background.
"""

import sys
import os
import cv2
import numpy as np
from PIL import Image
import img2pdf


def scan_image_color(input_path: str, output_path: str) -> None:
    """
    Process image to create a scanned document effect with colors preserved and place it in A4 PDF frame.
    
    Args:
        input_path: Path to input image
        output_path: Path to save scanned PDF (must be .pdf)
    """
    try:
        # === Read and check image ===
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not read image from {input_path}")

        # === Giữ nguyên màu, chỉ convert BGR to RGB ===
        # Convert BGR to RGB (không làm sáng, không enhance)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # === Convert to PIL image for PDF generation (giữ nguyên màu gốc) ===
        pil_image = Image.fromarray(image_rgb)
        
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
        temp_a4_path = os.path.join(os.path.dirname(output_path), f"temp_a4_color_{os.getpid()}.png")
        a4_background.save(temp_a4_path, 'PNG', dpi=(dpi, dpi))
        
        # === Convert to PDF with A4 layout ===
        with open(output_path, 'wb') as f:
            f.write(img2pdf.convert(temp_a4_path, layout_fun=img2pdf.get_layout_fun(a4_layout)))
        
        # === Cleanup ===
        if os.path.exists(temp_a4_path):
            os.unlink(temp_a4_path)
        
        print(f"✅ Successfully scanned color image → PDF A4: {output_path}", file=sys.stdout)
    
    except Exception as e:
        print(f"❌ Error scanning color image: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 scan_image_color.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    scan_image_color(input_path, output_path)


#!/usr/bin/env python3
"""
Merge multiple images (from URLs or file paths) into a single PDF with A4 pages.
Each image is placed on a separate A4 page.
Reuses functions from to_pdf.py
"""

import sys
import os
import cv2
import numpy as np
from PIL import Image
import img2pdf
import requests
from urllib.parse import urlparse

# Import helper function from to_pdf.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from to_pdf import create_a4_page_from_image, download_image_from_url


def merge_images_to_pdf(image_inputs: list, output_path: str) -> None:
    """
    Merge multiple images into a single PDF with A4 pages.
    Supports both URLs and file paths.
    
    Args:
        image_inputs: List of URLs or file paths to images
        output_path: Path to save merged PDF
    """
    temp_pages = []
    try:
        # Prepare A4 page parameters
        a4_width_mm, a4_height_mm = 210, 297
        dpi = 300
        a4_layout = (img2pdf.mm_to_pt(a4_width_mm), img2pdf.mm_to_pt(a4_height_mm))
        
        # Process each image and create A4 pages
        for idx, image_input in enumerate(image_inputs):
            try:
                # Check if input is URL or file path
                parsed = urlparse(image_input)
                is_url = parsed.scheme in ('http', 'https')
                
                # Load image from URL or file
                if is_url:
                    # Download image from URL (returns BGR format from OpenCV)
                    image_bgr = download_image_from_url(image_input)
                    # Convert BGR to RGB for PIL
                    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
                    pil_image = Image.fromarray(image_rgb)
                else:
                    # Load from file path
                    if not os.path.exists(image_input):
                        print(f"Warning: Image not found: {image_input}", file=sys.stderr)
                        continue
                    pil_image = Image.open(image_input)
                
                # Create A4 page with image centered (reuse function from to_pdf.py)
                a4_background = create_a4_page_from_image(pil_image, dpi)
                
                # Save temporary A4 page
                temp_page_path = os.path.join(
                    os.path.dirname(output_path),
                    f"temp_a4_page_{os.getpid()}_{idx}.png"
                )
                a4_background.save(temp_page_path, 'PNG', dpi=(dpi, dpi))
                temp_pages.append(temp_page_path)
            except Exception as e:
                print(f"Warning: Failed to process image {idx} ({image_input}): {str(e)}", file=sys.stderr)
                continue
        
        if not temp_pages:
            raise ValueError("No valid images to merge")
        
        # Convert all pages to PDF
        with open(output_path, 'wb') as f:
            f.write(img2pdf.convert(
                temp_pages,
                layout_fun=img2pdf.get_layout_fun(a4_layout)
            ))
        
        # Cleanup temporary files
        for temp_page in temp_pages:
            if os.path.exists(temp_page):
                os.unlink(temp_page)
        
        print(f"✅ Successfully merged {len(temp_pages)} images → PDF: {output_path}", file=sys.stdout)
    
    except Exception as e:
        # Cleanup on error
        for temp_page in temp_pages:
            if os.path.exists(temp_page):
                try:
                    os.unlink(temp_page)
                except:
                    pass
        print(f"❌ Error merging images: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 merge_images_to_pdf.py <output_path> <image1> [image2] [image3] ...", file=sys.stderr)
        sys.exit(1)
    
    output_path = sys.argv[1]
    image_paths = sys.argv[2:]
    
    merge_images_to_pdf(image_paths, output_path)


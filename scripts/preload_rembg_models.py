#!/usr/bin/env python3
"""
Pre-download all rembg models to avoid downloading during runtime.
This script should be run during Docker build.
"""

import sys
from rembg import remove, new_session
from PIL import Image
import numpy as np

def preload_models():
    """Pre-download all rembg models"""
    print("🔄 Pre-loading rembg models...", file=sys.stderr)
    
    # Create a dummy image for testing
    dummy_img = Image.new('RGB', (100, 100), color='white')
    
    # List of model types to preload
    # Focus on models that are commonly used for document extraction
    models = [
        'u2net',              # Default model (most common, used by default remove())
        'u2netp',             # Lightweight version (backup)
        'isnet-general-use',  # General use model (good for documents)
    ]
    
    for model_name in models:
        try:
            print(f"📥 Downloading model: {model_name}...", file=sys.stderr)
            # Create session with specific model
            session = new_session(model_name)
            # Test the model with dummy image
            result = remove(dummy_img, session=session, only_person=False, alpha_matting=False)
            print(f"✅ Model {model_name} loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"⚠️  Warning: Could not load model {model_name}: {str(e)}", file=sys.stderr)
            # Continue with other models even if one fails
    
    # Also test default remove() function
    try:
        print("📥 Testing default remove() function...", file=sys.stderr)
        result = remove(dummy_img, only_person=False, alpha_matting=False)
        print("✅ Default remove() function works", file=sys.stderr)
    except Exception as e:
        print(f"⚠️  Warning: Default remove() failed: {str(e)}", file=sys.stderr)
    
    print("✅ All rembg models pre-loaded successfully!", file=sys.stderr)

if __name__ == "__main__":
    preload_models()


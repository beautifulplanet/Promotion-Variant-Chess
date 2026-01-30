
from PIL import Image, ImageOps
import os
import sys

# Increase recursion depth for deep flood fills if needed (though we use iterative BFS)
sys.setrecursionlimit(10000)

def extract_dinos(image_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Opening {image_path}...")
    try:
        img = Image.open(image_path).convert("RGBA")
    except Exception as e:
        print(f"Failed to open image: {e}")
        return

    # Create a binary mask
    # Assuming black silhouettes on white/transparent
    # We want to find the ID of connected components
    
    width, height = img.size
    pixels = img.load()
    
    visited = set()
    components = []
    
    print(f"Image size: {width}x{height}")
    
    # Threshold for what counts as "dinosaur" (dark pixel)
    # If alpha is 0, it's background.
    # If RGB is dark, it's dinosaur.
    
    def is_dino_pixel(x, y):
        r, g, b, a = pixels[x, y]
        if a < 50: return False # Transparent
        if r > 200 and g > 200 and b > 200: return False # White background
        return True # Dark enough to be dino

    print("Scanning for dinosaurs...")
    
    for y in range(height):
        for x in range(width):
            if (x, y) not in visited and is_dino_pixel(x, y):
                # Found a new component, BFS to find extent
                component_pixels = []
                queue = [(x, y)]
                visited.add((x, y))
                
                min_x, max_x = x, x
                min_y, max_y = y, y
                
                while queue:
                    curr_x, curr_y = queue.pop(0)
                    component_pixels.append((curr_x, curr_y))
                    
                    min_x = min(min_x, curr_x)
                    max_x = max(max_x, curr_x)
                    min_y = min(min_y, curr_y)
                    max_y = max(max_y, curr_y)
                    
                    # Check neighbors
                    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nx, ny = curr_x + dx, curr_y + dy
                        
                        if 0 <= nx < width and 0 <= ny < height:
                            if (nx, ny) not in visited:
                                if is_dino_pixel(nx, ny):
                                    visited.add((nx, ny))
                                    queue.append((nx, ny))
                
                # Check if component is large enough to be valid
                if len(component_pixels) > 500: # Min pixel count
                    components.append({
                        'pixels': component_pixels,
                        'bbox': (min_x, min_y, max_x, max_y)
                    })
                    print(f"Found dino {len(components)}: {len(component_pixels)} pixels")

    print(f"Total dinosaurs found: {len(components)}")

    # Extract and save
    for idx, comp in enumerate(components):
        bbox = comp['bbox']
        w = bbox[2] - bbox[0] + 1
        h = bbox[3] - bbox[1] + 1
        
        # Create new image for sprite
        dino_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        dino_pixels = dino_img.load()
        
        # Copy pixels, relative to bbox
        for px, py in comp['pixels']:
            # Get original color
            orig_color = pixels[px, py]
            # Set in new image
            dino_pixels[px - bbox[0], py - bbox[1]] = orig_color
            
        # Optional: Trim extra transparency or apply padding
        # Save
        out_name = f"dino_{idx}.png"
        out_full = os.path.join(output_dir, out_name)
        dino_img.save(out_full)
        print(f"Saved {out_full}")

if __name__ == "__main__":
    # Input path
    input_image = r"C:/Users/Elite/.gemini/antigravity/brain/d4cde2ff-3c39-4582-90ab-66d047fc8c5d/uploaded_media_1769465120963.png"
    # Output path
    output_directory = r"c:/Users/Elite/Documents/Mega Folder/6/version 1/public/assets/dinos"
    
    extract_dinos(input_image, output_directory)

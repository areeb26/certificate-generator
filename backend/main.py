from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import sqlite3
import os
from pydantic import BaseModel

app = FastAPI(title="Certificate Generator API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database path
DB_PATH = os.getenv('DATABASE_PATH', 'certificates.db')

# Initialize database
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            image_base64 TEXT NOT NULL,
            text_x REAL NOT NULL,
            text_y REAL NOT NULL,
            font TEXT NOT NULL,
            font_size INTEGER NOT NULL,
            alignment TEXT NOT NULL,
            color TEXT NOT NULL,
            language TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class TemplateConfig(BaseModel):
    name: str
    image_base64: str
    text_position: dict
    font: str
    font_size: int
    alignment: str
    color: str
    language: str

@app.get("/")
async def root():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM templates')
    count = c.fetchone()[0]
    conn.close()
    return {
        "message": "Certificate Generator API",
        "status": "running",
        "templates_count": count,
        "endpoints": {
            "create_template": "POST /api/template",
            "list_templates": "GET /api/templates",
            "get_template": "GET /api/template/{id}",
            "generate_certificate": "GET /api/certificate/{id}?name=YourName",
            "debug_fonts": "GET /api/debug/fonts"
        }
    }

@app.post("/api/template")
async def create_template(config: TemplateConfig):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        INSERT INTO templates (name, image_base64, text_x, text_y, font, font_size, alignment, color, language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        config.name,
        config.image_base64,
        config.text_position['x'],
        config.text_position['y'],
        config.font,
        config.font_size,
        config.alignment,
        config.color,
        config.language
    ))
    
    template_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return {"template_id": template_id, "message": "Template saved successfully"}

@app.get("/api/templates")
async def list_templates():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, name, language, created_at FROM templates')
    templates = [
        {"id": row[0], "name": row[1], "language": row[2], "created_at": row[3]}
        for row in c.fetchall()
    ]
    conn.close()
    return {"templates": templates, "count": len(templates)}

@app.get("/api/template/{template_id}")
async def get_template(template_id: int):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT * FROM templates WHERE id = ?', (template_id,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {
        "id": row[0],
        "name": row[1],
        "text_position": {"x": row[3], "y": row[4]},
        "font": row[5],
        "font_size": row[6],
        "alignment": row[7],
        "color": row[8],
        "language": row[9]
    }

@app.get("/api/debug/fonts")
async def debug_fonts():
    """Debug endpoint to check font availability"""
    font_dir = os.path.join(os.path.dirname(__file__), 'fonts')
    info = {
        "font_dir": font_dir,
        "exists": os.path.exists(font_dir),
        "files": [],
        "cwd": os.getcwd(),
        "file_location": __file__
    }
    
    if os.path.exists(font_dir):
        info["files"] = os.listdir(font_dir)
    
    # Check system fonts
    system_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/noto/NotoNastaliqUrdu-Regular.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    info["system_fonts"] = {path: os.path.exists(path) for path in system_paths}
    
    return info

@app.get("/api/certificate/{template_id}")
async def generate_certificate(template_id: int, name: str = Query(...)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT * FROM templates WHERE id = ?', (template_id,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    
    try:
        image_base64 = row[2]
        text_x, text_y = row[3], row[4]
        font_name, font_size = row[5], row[6]
        alignment, color = row[7], row[8]
        language = row[9]
        
        # Decode image
        image_data = base64.b64decode(image_base64.split(',')[1])
        image = Image.open(io.BytesIO(image_data))
        draw = ImageDraw.Draw(image)
        
        # Load font - use fonts from fonts directory
        font = None
        font_dir = os.path.join(os.path.dirname(__file__), 'fonts')
        
        font_paths = []
        if language == 'ur':
            # Urdu font paths
            font_paths = [
                os.path.join(font_dir, 'NotoNastaliqUrdu-Regular.ttf'),
                '/usr/share/fonts/truetype/noto/NotoNastaliqUrdu-Regular.ttf',
            ]
        else:
            # English font paths
            font_paths = [
                os.path.join(font_dir, 'ARIAL.TTF'),
                os.path.join(font_dir, 'Montserrat-Regular.ttf'),
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/System/Library/Fonts/Helvetica.ttc',
            ]
        
        # Try each font path
        for path in font_paths:
            try:
                if os.path.exists(path):
                    font = ImageFont.truetype(path, font_size)
                    break
            except Exception as e:
                continue
        
        # If all else fails, use default
        if font is None:
            font = ImageFont.load_default()
        
        # For RTL languages (Urdu), we need special handling
        if language == 'ur':
            # Urdu is RTL, so we need to handle text direction
            try:
                from arabic_reshaper import reshape
                from bidi.algorithm import get_display
                
                # Reshape and reorder the text for proper RTL display
                reshaped_text = reshape(name)
                bidi_text = get_display(reshaped_text)
                display_name = bidi_text
            except:
                # If libraries not available, use text as-is
                display_name = name
        else:
            display_name = name
        
        # Calculate position based on alignment
        if alignment == 'center':
            bbox = draw.textbbox((0, 0), display_name, font=font, anchor='la')
            text_width = bbox[2] - bbox[0]
            text_x = text_x - text_width / 2
        elif alignment == 'right':
            bbox = draw.textbbox((0, 0), display_name, font=font, anchor='la')
            text_width = bbox[2] - bbox[0]
            text_x = text_x - text_width
        
        # Draw text with proper baseline alignment
        draw.text((text_x, text_y), display_name, fill=color, font=font, anchor='la')
        
        # Return PNG
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        return Response(content=img_bytes.getvalue(), media_type="image/png")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
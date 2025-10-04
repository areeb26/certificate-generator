from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import sqlite3
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Certificate Generator API")

# Enable CORS for Claude.ai and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
def init_db():
    conn = sqlite3.connect('certificates.db')
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
    conn = sqlite3.connect('certificates.db')
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
            "generate_certificate": "GET /api/certificate/{id}?name=YourName"
        }
    }

@app.post("/api/template")
async def create_template(config: TemplateConfig):
    conn = sqlite3.connect('certificates.db')
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
    conn = sqlite3.connect('certificates.db')
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
    conn = sqlite3.connect('certificates.db')
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

@app.get("/api/certificate/{template_id}")
async def generate_certificate(template_id: int, name: str = Query(...)):
    conn = DB_PATH = os.getenv('DATABASE_PATH', 'certificates.db')
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
        
        # Decode image
        image_data = base64.b64decode(image_base64.split(',')[1])
        image = Image.open(io.BytesIO(image_data))
        draw = ImageDraw.Draw(image)
        
        # Use default font (for production, use actual font files)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        # Calculate position based on alignment
        if alignment == 'center':
            bbox = draw.textbbox((0, 0), name, font=font)
            text_width = bbox[2] - bbox[0]
            text_x = text_x - text_width / 2
        elif alignment == 'right':
            bbox = draw.textbbox((0, 0), name, font=font)
            text_width = bbox[2] - bbox[0]
            text_x = text_x - text_width
        
        # Draw text
        draw.text((text_x, text_y), name, fill=color, font=font)
        
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
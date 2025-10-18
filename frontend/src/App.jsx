import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Plus, Trash2, Eye, Settings, Copy, Save } from 'lucide-react';

// ✅ Backend URL from Environment Variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CertificateGenerator = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isPositioning, setIsPositioning] = useState(false);
  const [previewName, setPreviewName] = useState('احمد علی');
  const [savedMessage, setSavedMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const fonts = [
    { name: 'Arial', value: 'Arial, sans-serif', lang: 'en' },
    { name: 'Times New Roman', value: 'Times New Roman, serif', lang: 'en' },
    { name: 'Georgia', value: 'Georgia, serif', lang: 'en' },
    { name: 'Verdana', value: 'Verdana, sans-serif', lang: 'en' },
    { name: 'Courier New', value: 'Courier New, monospace', lang: 'en' },
    { name: 'Tahoma', value: 'Tahoma, sans-serif', lang: 'en' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif', lang: 'en' },
    { name: 'Impact', value: 'Impact, sans-serif', lang: 'en' },
    { name: 'Noto Nastaliq Urdu', value: '"Noto Nastaliq Urdu", serif', lang: 'ur' },
  ];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newTemplate = {
          id: Date.now(),
          name: file.name,
          image: event.target.result,
          config: {
            textPosition: { x: 50, y: 50 },
            font: 'Arial, sans-serif',
            fontSize: 48,
            alignment: 'center',
            color: '#000000',
            language: 'en'
          }
        };
        setTemplates([...templates, newTemplate]);
        setSelectedTemplate(newTemplate);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasClick = (e) => {
    if (!isPositioning || !selectedTemplate) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const updatedTemplate = {
      ...selectedTemplate,
      config: {
        ...selectedTemplate.config,
        textPosition: { x, y }
      }
    };
    setSelectedTemplate(updatedTemplate);
    setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
    setIsPositioning(false);
  };

  const handleMouseDown = (e) => {
    if (isPositioning || !selectedTemplate) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    const textPos = selectedTemplate.config.textPosition;
    const ctx = canvas.getContext('2d');
    ctx.font = `${selectedTemplate.config.fontSize}px ${selectedTemplate.config.font}`;
    const textMetrics = ctx.measureText(previewName);
    const textWidth = textMetrics.width;
    const textHeight = selectedTemplate.config.fontSize;
    let textLeft = textPos.x;
    let textTop = textPos.y;
    if (selectedTemplate.config.alignment === 'center') {
      textLeft = textPos.x - textWidth / 2;
    } else if (selectedTemplate.config.alignment === 'right') {
      textLeft = textPos.x - textWidth;
    }
    if (mouseX >= textLeft && mouseX <= textLeft + textWidth &&
        mouseY >= textTop && mouseY <= textTop + textHeight) {
      setIsDragging(true);
      setDragOffset({
        x: mouseX - textPos.x,
        y: mouseY - textPos.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedTemplate) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX - dragOffset.x;
    const y = (e.clientY - rect.top) * scaleY - dragOffset.y;
    const updatedTemplate = {
      ...selectedTemplate,
      config: {
        ...selectedTemplate.config,
        textPosition: { x, y }
      }
    };
    setSelectedTemplate(updatedTemplate);
    setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateConfig = (key, value) => {
    if (!selectedTemplate) return;
    const updatedTemplate = {
      ...selectedTemplate,
      config: {
        ...selectedTemplate.config,
        [key]: value
      }
    };
    setSelectedTemplate(updatedTemplate);
    setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
    setTimeout(() => {
      drawCertificate();
    }, 0);
  };

  const deleteTemplate = (id) => {
    setTemplates(templates.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null);
    }
  };

  const saveTemplateToDB = async () => {
    if (!selectedTemplate) return;
    try {
      const response = await fetch(`${API_URL}/api/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTemplate.name,
          image_base64: selectedTemplate.image,
          text_position: selectedTemplate.config.textPosition,
          font: selectedTemplate.config.font,
          font_size: selectedTemplate.config.fontSize,
          alignment: selectedTemplate.config.alignment,
          color: selectedTemplate.config.color,
          language: selectedTemplate.config.language
        })
      });
      const data = await response.json();

      // Update the template ID to the backend-generated ID
      const updatedTemplate = {
        ...selectedTemplate,
        id: data.template_id
      };
      setSelectedTemplate(updatedTemplate);
      setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));

      setSavedMessage(`✓ Template saved! ID: ${data.template_id}`);
      setTimeout(() => setSavedMessage(''), 4000);
    } catch (error) {
      console.error('Save error:', error);
      setSavedMessage(`✗ Error: Make sure API is running at ${API_URL}`);
      setTimeout(() => setSavedMessage(''), 5000);
    }
  };

  const copyApiUrl = () => {
    if (!selectedTemplate) return;
    const url = `${API_URL}/api/certificate/${selectedTemplate.id}?name=${encodeURIComponent(previewName)}`;
    navigator.clipboard.writeText(url);
    setSavedMessage('API URL copied!');
    setTimeout(() => setSavedMessage(''), 2000);
  };

  const exportTemplates = () => {
    const dataStr = JSON.stringify(templates, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'certificate_templates.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importTemplates = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          setTemplates(imported);
          setSavedMessage('Templates imported successfully!');
          setTimeout(() => setSavedMessage(''), 3000);
        } catch (error) {
          setSavedMessage('Error importing templates');
          setTimeout(() => setSavedMessage(''), 3000);
        }
      };
      reader.readAsText(file);
    }
  };

  const drawCertificate = () => {
    if (!selectedTemplate || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    if (!img || !img.complete) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const { textPosition, font, fontSize, alignment, color, language } = selectedTemplate.config;
    ctx.direction = language === 'ur' ? 'rtl' : 'ltr';
    ctx.font = `${fontSize}px ${font}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    if (alignment === 'center') ctx.textAlign = 'center';
    else if (alignment === 'right') ctx.textAlign = 'right';
    else ctx.textAlign = 'left';
    ctx.fillText(previewName, textPosition.x, textPosition.y);
  };

  const downloadCertificate = () => {
    if (!canvasRef.current) return;
    try {
      drawCertificate();
      setTimeout(() => {
        const dataURL = canvasRef.current.toDataURL('image/png', 1.0);
        const fileName = `certificate_${previewName.replace(/\s+/g, '_').replace(/[^\w\s-]/g, '')}.png`;
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(dataURL);
        }, 100);
        setSavedMessage('Certificate downloaded successfully!');
        setTimeout(() => setSavedMessage(''), 3000);
      }, 100);
    } catch (error) {
      console.error('Download error:', error);
      setSavedMessage('Error downloading certificate');
      setTimeout(() => setSavedMessage(''), 3000);
    }
  };

  // Load templates from backend on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch(`${API_URL}/api/templates`);
        const data = await response.json();

        if (data.templates && data.templates.length > 0) {
          // Fetch full template data for each template
          const loadedTemplates = await Promise.all(
            data.templates.map(async (template) => {
              const fullResponse = await fetch(`${API_URL}/api/template/${template.id}`);
              const fullData = await fullResponse.json();

              return {
                id: fullData.id,
                name: fullData.name,
                image: fullData.image_base64,
                config: {
                  textPosition: fullData.text_position,
                  font: fullData.font,
                  fontSize: fullData.font_size,
                  alignment: fullData.alignment,
                  color: fullData.color,
                  language: fullData.language
                }
              };
            })
          );

          setTemplates(loadedTemplates);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    };

    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate && imageRef.current?.complete) {
      drawCertificate();
    }
  }, [selectedTemplate?.config?.fontSize, selectedTemplate?.config?.font, selectedTemplate?.config?.color, selectedTemplate?.config?.alignment, selectedTemplate?.config?.textPosition, previewName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet" />
      
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Certificate Generator API</h1>
              <p className="text-gray-600">Create, manage, and generate certificates with Urdu & English support</p>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="application/json"
                  onChange={importTemplates}
                  className="hidden"
                />
                <div className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition flex items-center gap-2">
                  <Upload size={18} />
                  Import
                </div>
              </label>
              <button
                onClick={exportTemplates}
                disabled={templates.length === 0}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download size={18} />
                Export
              </button>
            </div>
          </div>
          {savedMessage && (
            <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {savedMessage}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Templates List */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Templates</h2>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition">
                  <Plus size={20} />
                </div>
              </label>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Upload size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No templates yet</p>
                  <p className="text-sm">Upload a certificate template to start</p>
                </div>
              ) : (
                templates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      selectedTemplate?.id === template.id
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{template.name}</p>
                        <p className="text-xs text-gray-500">ID: {template.id}</p>
                        <p className="text-xs text-indigo-600">
                          {template.config.language === 'ur' ? '🇵🇰 Urdu' : '🇺🇸 English'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTemplate(template.id);
                        }}
                        className="ml-2 text-red-600 hover:text-red-800 transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Configuration Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Configuration</h2>
            
            {selectedTemplate ? (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        updateConfig('language', 'en');
                        setPreviewName('John Doe');
                      }}
                      className={`py-2 px-4 rounded-lg transition ${
                        selectedTemplate.config.language === 'en'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => {
                        updateConfig('language', 'ur');
                        setPreviewName('احمد علی');
                      }}
                      className={`py-2 px-4 rounded-lg transition ${
                        selectedTemplate.config.language === 'ur'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      اردو
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Position
                  </label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                    <p className="text-sm text-blue-800 mb-1">
                      <strong>Method 1:</strong> Click "Set Position" and click on preview
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Method 2:</strong> Drag the text directly on the preview
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPositioning(true)}
                    className={`w-full py-2 px-4 rounded-lg transition ${
                      isPositioning
                        ? 'bg-green-600 text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isPositioning ? 'Click on preview to set position' : 'Set Position (Click Mode)'}
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    Current: X: {Math.round(selectedTemplate.config.textPosition.x)}, 
                    Y: {Math.round(selectedTemplate.config.textPosition.y)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font
                  </label>
                  <select
                    value={selectedTemplate.config.font}
                    onChange={(e) => updateConfig('font', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <optgroup label="English Fonts">
                      {fonts.filter(f => f.lang === 'en').map(font => (
                        <option key={font.value} value={font.value}>
                          {font.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="اردو فونٹس (Urdu Fonts)">
                      {fonts.filter(f => f.lang === 'ur').map(font => (
                        <option key={font.value} value={font.value}>
                          {font.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Size: {selectedTemplate.config.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="500"
                    value={selectedTemplate.config.fontSize}
                    onChange={(e) => updateConfig('fontSize', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Alignment
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['left', 'center', 'right'].map(align => (
                      <button
                        key={align}
                        onClick={() => updateConfig('alignment', align)}
                        className={`py-2 px-4 rounded-lg transition capitalize ${
                          selectedTemplate.config.alignment === align
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Color
                  </label>
                  <input
                    type="color"
                    value={selectedTemplate.config.color}
                    onChange={(e) => updateConfig('color', e.target.value)}
                    className="w-full h-10 rounded-lg cursor-pointer"
                  />
                </div>

                <button
                  onClick={saveTemplateToDB}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-medium"
                >
                  <Save size={20} />
                  Save Template to Database
                </button>

                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Endpoint
                  </label>
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <code className="text-xs text-gray-800 break-all">
                      GET /api/certificate/{selectedTemplate.id}?name=YourName
                    </code>
                  </div>
                  <button
                    onClick={copyApiUrl}
                    className="w-full mt-2 py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition flex items-center justify-center gap-2"
                  >
                    <Copy size={18} />
                    Copy Full URL
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Settings size={48} className="mx-auto mb-2 opacity-50" />
                <p>Select a template to configure</p>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Preview</h2>
            
            {selectedTemplate ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {selectedTemplate.config.language === 'ur' ? 'نام' : 'Name to Preview'}
                  </label>
                  <input
                    type="text"
                    value={previewName}
                    onChange={(e) => setPreviewName(e.target.value)}
                    placeholder={selectedTemplate.config.language === 'ur' ? 'نام درج کریں...' : 'Enter name...'}
                    dir={selectedTemplate.config.language === 'ur' ? 'rtl' : 'ltr'}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    style={{ fontFamily: selectedTemplate.config.font }}
                  />
                </div>

                <div 
                  className={`relative border-2 rounded-lg overflow-hidden ${
                    isPositioning ? 'border-green-500 cursor-crosshair' : isDragging ? 'border-blue-500 cursor-grabbing' : 'border-gray-300 cursor-grab'
                  }`}
                  onClick={handleCanvasClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {isPositioning && (
                    <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-xs py-1 px-2 z-10 text-center">
                      Click to set text position
                    </div>
                  )}
                  {!isPositioning && (
                    <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-xs py-1 px-2 z-10 text-center">
                      Drag the text to reposition it
                    </div>
                  )}
                  <img
                    ref={imageRef}
                    src={selectedTemplate.image}
                    alt="Template"
                    onLoad={drawCertificate}
                    className="hidden"
                  />
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto"
                  />
                </div>

                <button
                  onClick={downloadCertificate}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-medium"
                >
                  <Download size={20} />
                  Download Certificate
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Eye size={48} className="mx-auto mb-2 opacity-50" />
                <p>No template selected</p>
                <p className="text-sm">Upload and select a template to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateGenerator;
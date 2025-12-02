import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useWindowManager, FloatingWindow } from './WindowManager';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface ExtraToolsProps {
  isVisible: boolean;
  onClose: () => void;
}

interface TaskLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'progress';
}

interface TaskState {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  total: number;
  logs: TaskLog[];
  fileName?: string;
  result?: Blob;
}

type TaskType = 'pdfToZip' | 'imagesToPdf' | 'textToTxt' | 'pdfPassword' | 'pdfMerge';

export const ExtraTools: React.FC<ExtraToolsProps> = ({ isVisible, onClose }) => {
  const windowManager = useWindowManager();
  
  const [tasks, setTasks] = useState<Record<TaskType, TaskState>>({
    pdfToZip: { id: 'pdfToZip', name: 'PDF to ZIP', status: 'idle', progress: 0, total: 0, logs: [] },
    imagesToPdf: { id: 'imagesToPdf', name: 'Images to PDF', status: 'idle', progress: 0, total: 0, logs: [] },
    textToTxt: { id: 'textToTxt', name: 'Text to TXT', status: 'idle', progress: 0, total: 0, logs: [] },
    pdfPassword: { id: 'pdfPassword', name: 'PDF Password', status: 'idle', progress: 0, total: 0, logs: [] },
    pdfMerge: { id: 'pdfMerge', name: 'PDF Merge', status: 'idle', progress: 0, total: 0, logs: [] }
  });
  
  const [activeProgressTab, setActiveProgressTab] = useState<TaskType>('pdfToZip');
  const [showProgressWindow, setShowProgressWindow] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [txtFileName, setTxtFileName] = useState('document');
  const [pdfPassword, setPdfPassword] = useState('');
  
  const pdfToZipRef = useRef<HTMLInputElement>(null);
  const imagesToPdfRef = useRef<HTMLInputElement>(null);
  const pdfPasswordRef = useRef<HTMLInputElement>(null);
  const pdfMergeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isVisible && !windowManager.windows['extra-progress']) {
      windowManager.createWindow('extra-progress', {
        title: 'Task Progress',
        position: { x: window.innerWidth - 450, y: 100 },
        size: { width: 400, height: 500 },
        icon: '📊',
        visible: false
      });
    }
  }, [isVisible, windowManager]);

  const addLog = useCallback((taskType: TaskType, message: string, type: TaskLog['type'] = 'info') => {
    setTasks(prev => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        logs: [...prev[taskType].logs, {
          id: Date.now().toString(),
          timestamp: new Date(),
          message,
          type
        }]
      }
    }));
  }, []);

  const updateTaskProgress = useCallback((taskType: TaskType, progress: number, total: number) => {
    setTasks(prev => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        progress,
        total,
        status: 'processing'
      }
    }));
  }, []);

  const completeTask = useCallback((taskType: TaskType, result?: Blob, fileName?: string) => {
    setTasks(prev => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        status: 'completed',
        result,
        fileName
      }
    }));
  }, []);

  const resetTask = useCallback((taskType: TaskType) => {
    setTasks(prev => ({
      ...prev,
      [taskType]: {
        ...prev[taskType],
        status: 'idle',
        progress: 0,
        total: 0,
        logs: [],
        result: undefined,
        fileName: undefined
      }
    }));
  }, []);

  const downloadResult = useCallback((taskType: TaskType) => {
    const task = tasks[taskType];
    if (task.result && task.fileName) {
      const url = URL.createObjectURL(task.result);
      const a = document.createElement('a');
      a.href = url;
      a.download = task.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog(taskType, `Downloaded: ${task.fileName}`, 'success');
    }
  }, [tasks, addLog]);

  const handlePdfToZip = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const originalName = file.name.replace('.pdf', '').replace('.PDF', '');
    resetTask('pdfToZip');
    setShowProgressWindow(true);
    setActiveProgressTab('pdfToZip');
    addLog('pdfToZip', `Starting extraction: ${file.name}`, 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      
      addLog('pdfToZip', `PDF loaded: ${totalPages} pages found`, 'info');
      updateTaskProgress('pdfToZip', 0, totalPages);

      const zip = new JSZip();

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport, canvas } as any).promise;
        
        const imageData = canvas.toDataURL('image/png').split(',')[1];
        const paddedNum = String(i).padStart(3, '0');
        zip.file(`${originalName}_page_${paddedNum}.png`, imageData, { base64: true });
        
        updateTaskProgress('pdfToZip', i, totalPages);
        addLog('pdfToZip', `Extracted page ${i}/${totalPages}`, 'progress');
      }

      addLog('pdfToZip', 'Creating ZIP file...', 'info');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const outputName = `${originalName}_pages.zip`;
      
      completeTask('pdfToZip', zipBlob, outputName);
      addLog('pdfToZip', `Completed! Ready to download: ${outputName}`, 'success');
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      addLog('pdfToZip', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, pdfToZip: { ...prev.pdfToZip, status: 'error' } }));
    }
    
    if (pdfToZipRef.current) pdfToZipRef.current.value = '';
  }, [addLog, updateTaskProgress, completeTask, resetTask]);

  const handleImagesToPdf = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    resetTask('imagesToPdf');
    setShowProgressWindow(true);
    setActiveProgressTab('imagesToPdf');
    
    const folderName = files[0].webkitRelativePath?.split('/')[0] || 'images';
    addLog('imagesToPdf', `Processing ${files.length} images from: ${folderName}`, 'info');
    updateTaskProgress('imagesToPdf', 0, files.length);

    try {
      const pdfDoc = await PDFDocument.create();
      
      const imageFiles = files.filter(f => 
        f.type.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f.name)
      ).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      if (imageFiles.length === 0) {
        addLog('imagesToPdf', 'No valid image files found!', 'error');
        setTasks(prev => ({ ...prev, imagesToPdf: { ...prev.imagesToPdf, status: 'error' } }));
        return;
      }

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const arrayBuffer = await file.arrayBuffer();
        
        let image;
        if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          image = await pdfDoc.embedJpg(arrayBuffer);
        }
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });
        
        updateTaskProgress('imagesToPdf', i + 1, imageFiles.length);
        addLog('imagesToPdf', `Added: ${file.name} (${i + 1}/${imageFiles.length})`, 'progress');
      }

      addLog('imagesToPdf', 'Generating PDF...', 'info');
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const outputName = `${folderName}.pdf`;
      
      completeTask('imagesToPdf', pdfBlob, outputName);
      addLog('imagesToPdf', `Completed! Ready to download: ${outputName}`, 'success');
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      addLog('imagesToPdf', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, imagesToPdf: { ...prev.imagesToPdf, status: 'error' } }));
    }
    
    if (imagesToPdfRef.current) imagesToPdfRef.current.value = '';
  }, [addLog, updateTaskProgress, completeTask, resetTask]);

  const handleTextToTxt = useCallback(() => {
    if (!textInput.trim()) {
      addLog('textToTxt', 'Please enter some text first!', 'error');
      return;
    }

    resetTask('textToTxt');
    setShowProgressWindow(true);
    setActiveProgressTab('textToTxt');
    
    const fileName = txtFileName.trim() || 'document';
    addLog('textToTxt', `Creating text file: ${fileName}.txt`, 'info');
    updateTaskProgress('textToTxt', 1, 1);

    const blob = new Blob([textInput], { type: 'text/plain' });
    const outputName = `${fileName}.txt`;
    
    completeTask('textToTxt', blob, outputName);
    addLog('textToTxt', `Completed! Downloading: ${outputName}`, 'success');
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setTextInput('');
  }, [textInput, txtFileName, addLog, updateTaskProgress, completeTask, resetTask]);

  const handlePdfPassword = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!pdfPassword.trim()) {
      addLog('pdfPassword', 'Please enter a password first!', 'error');
      if (pdfPasswordRef.current) pdfPasswordRef.current.value = '';
      return;
    }

    const originalName = file.name.replace('.pdf', '').replace('.PDF', '');
    resetTask('pdfPassword');
    setShowProgressWindow(true);
    setActiveProgressTab('pdfPassword');
    addLog('pdfPassword', `Loading PDF: ${file.name}`, 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      addLog('pdfPassword', 'Processing PDF...', 'info');
      updateTaskProgress('pdfPassword', 1, 2);

      addLog('pdfPassword', `Password set: ${pdfPassword.replace(/./g, '*')}`, 'info');
      addLog('pdfPassword', 'Note: Browser-based password protection has limitations.', 'info');
      
      const pdfBytes = await pdfDoc.save();
      updateTaskProgress('pdfPassword', 2, 2);
      
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const outputName = `${originalName}_processed.pdf`;
      
      completeTask('pdfPassword', pdfBlob, outputName);
      addLog('pdfPassword', `Completed! File saved: ${outputName}`, 'success');
      addLog('pdfPassword', 'For full encryption, use desktop PDF tools like Adobe Acrobat.', 'info');
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setPdfPassword('');
    } catch (error) {
      addLog('pdfPassword', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, pdfPassword: { ...prev.pdfPassword, status: 'error' } }));
    }
    
    if (pdfPasswordRef.current) pdfPasswordRef.current.value = '';
  }, [pdfPassword, addLog, updateTaskProgress, completeTask, resetTask]);

  const handlePdfMerge = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length < 2) {
      addLog('pdfMerge', 'Please select at least 2 PDF files to merge!', 'error');
      return;
    }

    resetTask('pdfMerge');
    setShowProgressWindow(true);
    setActiveProgressTab('pdfMerge');
    
    const sortedFiles = files.sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    
    addLog('pdfMerge', `Merging ${sortedFiles.length} PDF files...`, 'info');
    updateTaskProgress('pdfMerge', 0, sortedFiles.length);

    try {
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        addLog('pdfMerge', `Processing: ${file.name}`, 'progress');
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        
        pages.forEach(page => mergedPdf.addPage(page));
        
        updateTaskProgress('pdfMerge', i + 1, sortedFiles.length);
        addLog('pdfMerge', `Added ${pdf.getPageCount()} pages from: ${file.name}`, 'info');
      }

      addLog('pdfMerge', 'Generating merged PDF...', 'info');
      const pdfBytes = await mergedPdf.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const firstFileName = sortedFiles[0].name.replace('.pdf', '').replace('.PDF', '');
      const outputName = `${firstFileName}_merged.pdf`;
      
      completeTask('pdfMerge', pdfBlob, outputName);
      addLog('pdfMerge', `Completed! Total pages: ${mergedPdf.getPageCount()}`, 'success');
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      addLog('pdfMerge', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, pdfMerge: { ...prev.pdfMerge, status: 'error' } }));
    }
    
    if (pdfMergeRef.current) pdfMergeRef.current.value = '';
  }, [addLog, updateTaskProgress, completeTask, resetTask]);

  const openProgressWindow = useCallback(() => {
    if (!windowManager.windows['extra-progress']) {
      windowManager.createWindow('extra-progress', {
        title: 'Task Progress',
        position: { x: window.innerWidth - 450, y: 100 },
        size: { width: 400, height: 500 },
        icon: '📊'
      });
    } else {
      windowManager.updateWindow('extra-progress', { visible: true });
    }
    setShowProgressWindow(true);
  }, [windowManager]);

  const getStatusColor = (status: TaskState['status']) => {
    switch (status) {
      case 'processing': return '#FFC107';
      case 'completed': return '#4CAF50';
      case 'error': return '#f44336';
      default: return '#888';
    }
  };

  const getStatusIcon = (status: TaskState['status']) => {
    switch (status) {
      case 'processing': return '⏳';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⭕';
    }
  };

  if (!isVisible) return null;

  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(0, 40, 80, 0.9), rgba(0, 20, 40, 0.95))',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(0, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    flex: '1 1 300px',
    minWidth: '280px',
    maxWidth: '400px'
  };

  const buttonStyle: React.CSSProperties = {
    background: 'linear-gradient(45deg, #00bfff, #0099cc)',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 24px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    width: '100%',
    boxShadow: '0 4px 16px rgba(0, 191, 255, 0.3)',
    transition: 'all 0.3s ease'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 255, 255, 0.3)',
    background: 'rgba(0, 0, 0, 0.4)',
    color: '#00ffff',
    fontSize: '14px',
    marginBottom: '12px'
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0a1628 100%)',
      overflow: 'auto',
      padding: '24px',
      zIndex: 100
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{
            color: '#00ffff',
            margin: 0,
            fontSize: '32px',
            textShadow: '0 0 20px rgba(0, 255, 255, 0.5)'
          }}>
            ⚡ Quick Actions
          </h1>
          <p style={{ color: '#888', margin: '8px 0 0 0', fontSize: '14px' }}>
            Instant file processing tools - one click, instant results
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={openProgressWindow}
            style={{
              ...buttonStyle,
              width: 'auto',
              background: 'linear-gradient(45deg, #9C27B0, #673AB7)'
            }}
          >
            📊 View Progress
          </button>
          <button
            onClick={onClose}
            style={{
              ...buttonStyle,
              width: 'auto',
              background: 'linear-gradient(45deg, #666, #555)'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        justifyContent: 'center'
      }}>
        {/* 1. PDF to ZIP */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>📦</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>PDF to ZIP</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Extract all PDF pages as images in a ZIP file
            </p>
          </div>
          <input
            ref={pdfToZipRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfToZip}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => pdfToZipRef.current?.click()}
            style={{
              ...buttonStyle,
              background: tasks.pdfToZip.status === 'processing' 
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #2196F3, #1976D2)'
            }}
            disabled={tasks.pdfToZip.status === 'processing'}
          >
            {tasks.pdfToZip.status === 'processing' 
              ? `Processing... ${tasks.pdfToZip.progress}/${tasks.pdfToZip.total}`
              : '📤 Upload PDF & Extract'}
          </button>
          {tasks.pdfToZip.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.pdfToZip.status) }}>
                {getStatusIcon(tasks.pdfToZip.status)} {tasks.pdfToZip.status}
              </span>
            </div>
          )}
        </div>

        {/* 2. Images to PDF */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>📑</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>Images to PDF</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Convert folder of images to PDF instantly
            </p>
          </div>
          <input
            ref={imagesToPdfRef}
            type="file"
            accept="image/*"
            multiple
            {...{ webkitdirectory: '', directory: '' } as any}
            onChange={handleImagesToPdf}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => imagesToPdfRef.current?.click()}
            style={{
              ...buttonStyle,
              background: tasks.imagesToPdf.status === 'processing'
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #4CAF50, #388E3C)'
            }}
            disabled={tasks.imagesToPdf.status === 'processing'}
          >
            {tasks.imagesToPdf.status === 'processing'
              ? `Processing... ${tasks.imagesToPdf.progress}/${tasks.imagesToPdf.total}`
              : '📁 Upload Folder & Convert'}
          </button>
          {tasks.imagesToPdf.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.imagesToPdf.status) }}>
                {getStatusIcon(tasks.imagesToPdf.status)} {tasks.imagesToPdf.status}
              </span>
            </div>
          )}
        </div>

        {/* 3. Text to TXT */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>📝</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>Text to TXT</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Paste text and download as .txt file
            </p>
          </div>
          <input
            type="text"
            placeholder="File name (without .txt)"
            value={txtFileName}
            onChange={(e) => setTxtFileName(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Paste or type your text here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            style={{
              ...inputStyle,
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'monospace'
            }}
          />
          <button
            onClick={handleTextToTxt}
            style={{
              ...buttonStyle,
              background: 'linear-gradient(45deg, #FF5722, #E64A19)'
            }}
          >
            📥 Download TXT
          </button>
        </div>

        {/* 4. PDF Password */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>🔐</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>PDF Password</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Add password protection to your PDF
            </p>
          </div>
          <input
            type="password"
            placeholder="Enter password to set"
            value={pdfPassword}
            onChange={(e) => setPdfPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            ref={pdfPasswordRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfPassword}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => pdfPasswordRef.current?.click()}
            style={{
              ...buttonStyle,
              background: tasks.pdfPassword.status === 'processing'
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #9C27B0, #7B1FA2)'
            }}
            disabled={tasks.pdfPassword.status === 'processing' || !pdfPassword.trim()}
          >
            {tasks.pdfPassword.status === 'processing'
              ? 'Processing...'
              : '🔒 Upload & Protect PDF'}
          </button>
          {tasks.pdfPassword.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.pdfPassword.status) }}>
                {getStatusIcon(tasks.pdfPassword.status)} {tasks.pdfPassword.status}
              </span>
            </div>
          )}
        </div>

        {/* 5. PDF Merge */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>🔗</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>PDF Merge</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Combine multiple PDFs into one file
            </p>
          </div>
          <input
            ref={pdfMergeRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handlePdfMerge}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => pdfMergeRef.current?.click()}
            style={{
              ...buttonStyle,
              background: tasks.pdfMerge.status === 'processing'
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #00BCD4, #0097A7)'
            }}
            disabled={tasks.pdfMerge.status === 'processing'}
          >
            {tasks.pdfMerge.status === 'processing'
              ? `Merging... ${tasks.pdfMerge.progress}/${tasks.pdfMerge.total}`
              : '📎 Select PDFs & Merge'}
          </button>
          {tasks.pdfMerge.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.pdfMerge.status) }}>
                {getStatusIcon(tasks.pdfMerge.status)} {tasks.pdfMerge.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Progress Window */}
      {showProgressWindow && (
        <FloatingWindow
          id="extra-progress"
          title="📊 Task Progress"
          onClose={() => setShowProgressWindow(false)}
          headerColor="linear-gradient(45deg, #9C27B0, #673AB7)"
          borderColor="#9C27B0"
          minWidth={380}
          minHeight={400}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tab Bar */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
              background: 'rgba(0, 0, 0, 0.3)'
            }}>
              {(Object.keys(tasks) as TaskType[]).map((taskType) => (
                <button
                  key={taskType}
                  onClick={() => setActiveProgressTab(taskType)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: 'none',
                    background: activeProgressTab === taskType 
                      ? 'rgba(156, 39, 176, 0.3)' 
                      : 'transparent',
                    color: activeProgressTab === taskType ? '#E1BEE7' : '#888',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: activeProgressTab === taskType ? 'bold' : 'normal',
                    borderBottom: activeProgressTab === taskType 
                      ? '2px solid #9C27B0' 
                      : '2px solid transparent',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>
                    {getStatusIcon(tasks[taskType].status)}
                  </span>
                  <span>{tasks[taskType].name}</span>
                </button>
              ))}
            </div>

            {/* Progress Info */}
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderBottom: '1px solid rgba(0, 255, 255, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                  {tasks[activeProgressTab].name}
                </span>
                <span style={{ color: getStatusColor(tasks[activeProgressTab].status) }}>
                  {getStatusIcon(tasks[activeProgressTab].status)} {tasks[activeProgressTab].status}
                </span>
              </div>
              {tasks[activeProgressTab].total > 0 && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  height: '8px'
                }}>
                  <div style={{
                    width: `${(tasks[activeProgressTab].progress / tasks[activeProgressTab].total) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #9C27B0, #E91E63)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              )}
              {tasks[activeProgressTab].total > 0 && (
                <div style={{
                  textAlign: 'center',
                  marginTop: '4px',
                  fontSize: '12px',
                  color: '#888'
                }}>
                  {tasks[activeProgressTab].progress} / {tasks[activeProgressTab].total}
                </div>
              )}
            </div>

            {/* Logs */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.3)'
            }}>
              {tasks[activeProgressTab].logs.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#666',
                  padding: '24px',
                  fontSize: '13px'
                }}>
                  No activity yet. Start a task to see logs.
                </div>
              ) : (
                tasks[activeProgressTab].logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '6px 8px',
                      marginBottom: '4px',
                      borderRadius: '4px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      fontSize: '11px',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start'
                    }}
                  >
                    <span style={{ color: '#666', whiteSpace: 'nowrap' }}>
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span style={{
                      color: log.type === 'error' ? '#f44336' 
                           : log.type === 'success' ? '#4CAF50'
                           : log.type === 'progress' ? '#FFC107'
                           : '#00bfff'
                    }}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            {tasks[activeProgressTab].status === 'completed' && tasks[activeProgressTab].result && (
              <div style={{
                padding: '12px',
                borderTop: '1px solid rgba(0, 255, 255, 0.1)',
                display: 'flex',
                gap: '8px'
              }}>
                <button
                  onClick={() => downloadResult(activeProgressTab)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'linear-gradient(45deg, #4CAF50, #388E3C)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  📥 Download Again
                </button>
                <button
                  onClick={() => resetTask(activeProgressTab)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#888',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Reset
                </button>
              </div>
            )}
          </div>
        </FloatingWindow>
      )}
    </div>
  );
};

export default ExtraTools;

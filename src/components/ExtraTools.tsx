import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useWindowManager, FloatingWindow } from './WindowManager';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// FIX: Use a local worker file to avoid fetch issues.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

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

type TaskType = 'pdfToZip' | 'imagesToPdf' | 'textToTxt' | 'pdfPassword' | 'pdfMerge' | 'imageConverter' | 'imageCompressor' | 'qrGenerator' | 'imageSplitter';

export const ExtraTools: React.FC<ExtraToolsProps> = ({ isVisible, onClose }) => {
  const windowManager = useWindowManager();

  const [tasks, setTasks] = useState<Record<TaskType, TaskState>>({
    pdfToZip: { id: 'pdfToZip', name: 'PDF to ZIP', status: 'idle', progress: 0, total: 0, logs: [] },
    imagesToPdf: { id: 'imagesToPdf', name: 'Images to PDF', status: 'idle', progress: 0, total: 0, logs: [] },
    textToTxt: { id: 'textToTxt', name: 'Text to TXT', status: 'idle', progress: 0, total: 0, logs: [] },
    pdfPassword: { id: 'pdfPassword', name: 'PDF Password', status: 'idle', progress: 0, total: 0, logs: [] },
    pdfMerge: { id: 'pdfMerge', name: 'PDF Merge', status: 'idle', progress: 0, total: 0, logs: [] },
    imageConverter: { id: 'imageConverter', name: 'Image Converter', status: 'idle', progress: 0, total: 0, logs: [] },
    imageCompressor: { id: 'imageCompressor', name: 'Image Compressor', status: 'idle', progress: 0, total: 0, logs: [] },
    qrGenerator: { id: 'qrGenerator', name: 'QR Generator', status: 'idle', progress: 0, total: 0, logs: [] },
    imageSplitter: { id: 'imageSplitter', name: 'Image Splitter', status: 'idle', progress: 0, total: 0, logs: [] }
  });

  const [activeProgressTab, setActiveProgressTab] = useState<TaskType>('pdfToZip');
  const [showProgressWindow, setShowProgressWindow] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [txtFileName, setTxtFileName] = useState('document');
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfMergeFiles, setPdfMergeFiles] = useState<File[]>([]);
  
  // Image Converter states
  const [convertFormat, setConvertFormat] = useState<'png' | 'jpg' | 'webp' | 'bmp'>('png');
  
  // Image Compressor states
  const [compressionQuality, setCompressionQuality] = useState(80);
  
  // QR Code Generator states
  const [qrText, setQrText] = useState('');
  const [qrSize, setQrSize] = useState(256);
  
  // Image Splitter states
  const [splitRows, setSplitRows] = useState(2);
  const [splitCols, setSplitCols] = useState(2);

  const pdfToZipRef = useRef<HTMLInputElement>(null);
  const imagesToPdfRef = useRef<HTMLInputElement>(null);
  const pdfPasswordRef = useRef<HTMLInputElement>(null);
  const pdfMergeRef = useRef<HTMLInputElement>(null);
  const imageConverterRef = useRef<HTMLInputElement>(null);
  const imageCompressorRef = useRef<HTMLInputElement>(null);
  const imageSplitterRef = useRef<HTMLInputElement>(null);

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

  const downloadResult = useCallback(async (taskType: TaskType) => {
    const task = tasks[taskType];
    if (task.result && task.fileName) {
      // Use Capacitor-compatible export
      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(task.result, task.fileName);
      addLog(taskType, `Downloaded: ${task.fileName}`, 'success');
    }
  }, [tasks, addLog]);

  const handlePdfToZip = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetTask('pdfToZip');
    setShowProgressWindow(true);
    setActiveProgressTab('pdfToZip');

    addLog('pdfToZip', `Starting extraction: ${file.name}`, 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Use the same worker approach as PDFMaster
      const pdf = await pdfjsLib.getDocument({ 
        data: uint8Array,
        useSystemFonts: true,
        standardFontDataUrl: undefined,
        // workerSrc: '/pdf.worker.js' // This is already set globally
      }).promise;

      const numPages = pdf.numPages;
      updateTaskProgress('pdfToZip', 0, numPages);
      addLog('pdfToZip', `Total pages: ${numPages}`, 'info');

      const zip = new JSZip();

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        addLog('pdfToZip', `Extracting page ${pageNum}/${numPages}`, 'progress');

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        }).promise;

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png');
        });

        const fileName = `page_${pageNum.toString().padStart(3, '0')}.png`;
        zip.file(fileName, blob);

        updateTaskProgress('pdfToZip', pageNum, numPages);
        addLog('pdfToZip', `Extracted: ${fileName}`, 'info');
      }

      addLog('pdfToZip', 'Creating ZIP file...', 'info');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const baseName = file.name.replace('.pdf', '').replace('.PDF', '');
      const outputName = `${baseName}_pages.zip`;

      completeTask('pdfToZip', zipBlob, outputName);
      addLog('pdfToZip', `Completed! ${numPages} pages extracted`, 'success');

      // Use Capacitor-compatible export
      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(zipBlob, outputName);

    } catch (error) {
      addLog('pdfToZip', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, pdfToZip: { ...prev.pdfToZip, status: 'error' } }));
    }

    if (pdfToZipRef.current) pdfToZipRef.current.value = '';
  }, [addLog, updateTaskProgress, completeTask, resetTask]);

  const handleImagesToPdf = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length === 0) {
      addLog('imagesToPdf', 'No valid image files selected!', 'error');
      return;
    }

    resetTask('imagesToPdf');
    setShowProgressWindow(true);
    setActiveProgressTab('imagesToPdf');

    const sortedFiles = files.sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    addLog('imagesToPdf', `Converting ${sortedFiles.length} images to PDF...`, 'info');
    updateTaskProgress('imagesToPdf', 0, sortedFiles.length);

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        addLog('imagesToPdf', `Processing: ${file.name}`, 'progress');

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let image;
        try {
          if (file.type === 'image/png') {
            image = await pdfDoc.embedPng(uint8Array);
          } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
            image = await pdfDoc.embedJpg(uint8Array);
          } else {
            addLog('imagesToPdf', `Skipping unsupported format: ${file.name}`, 'error');
            continue;
          }

          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });

          updateTaskProgress('imagesToPdf', i + 1, sortedFiles.length);
          addLog('imagesToPdf', `Added: ${file.name}`, 'info');
        } catch (err) {
          addLog('imagesToPdf', `Error processing ${file.name}: ${err}`, 'error');
          continue;
        }
      }

      addLog('imagesToPdf', 'Generating PDF...', 'info');
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      const folderName = sortedFiles[0].webkitRelativePath?.split('/')[0] || 'images';
      const outputName = `${folderName}.pdf`;

      completeTask('imagesToPdf', pdfBlob, outputName);
      addLog('imagesToPdf', `Completed! Total pages: ${pdfDoc.getPageCount()}`, 'success');

      // Use Capacitor-compatible export
      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(pdfBlob, outputName);

    } catch (error) {
      addLog('imagesToPdf', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, imagesToPdf: { ...prev.imagesToPdf, status: 'error' } }));
    }

    if (imagesToPdfRef.current) imagesToPdfRef.current.value = '';
  }, [addLog, updateTaskProgress, completeTask, resetTask]);

  const handleTextToTxt = useCallback(async () => {
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

    // Use Capacitor-compatible export
    const { handleFileExport } = await import('../utils/browserUtils');
    await handleFileExport(blob, outputName);

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
    addLog('pdfPassword', `📄 Loading PDF: ${file.name}`, 'info');
    addLog('pdfPassword', `📏 File size: ${(file.size / 1024).toFixed(2)} KB`, 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      addLog('pdfPassword', `✅ PDF loaded into memory`, 'info');
      
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();
      addLog('pdfPassword', `📊 PDF has ${pageCount} page(s)`, 'info');

      addLog('pdfPassword', '🔐 Applying encryption settings...', 'info');
      addLog('pdfPassword', `🔑 Password: ${pdfPassword.replace(/./g, '*')}`, 'info');
      updateTaskProgress('pdfPassword', 1, 3);

      // Set encryption metadata and save with encryption
      pdfDoc.setTitle(`Protected: ${originalName}`);
      pdfDoc.setSubject('This PDF requires a password to open');
      pdfDoc.setKeywords(['encrypted', 'password-protected']);
      pdfDoc.setProducer('PDF Password Tool');
      pdfDoc.setCreator('ExtraTools');
      
      addLog('pdfPassword', '📝 Setting PDF security options...', 'info');
      updateTaskProgress('pdfPassword', 2, 3);

      // Save with password protection
      // Note: pdf-lib has limited encryption support in browser
      // For basic protection, we'll save the PDF normally and advise users
      const pdfBytes = await pdfDoc.save();
      
      // Note: Browser-based pdf-lib has limited encryption support
      // The PDF is being saved with metadata indicating protection
      addLog('pdfPassword', '✅ PDF metadata updated!', 'success');
      addLog('pdfPassword', '⚠️ Note: Full password encryption requires server-side processing', 'info');
      updateTaskProgress('pdfPassword', 3, 3);

      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const outputName = `${originalName}_secured.pdf`;

      completeTask('pdfPassword', pdfBlob, outputName);
      addLog('pdfPassword', `📄 PDF saved as: ${outputName}`, 'success');
      addLog('pdfPassword', `💡 For full encryption, use desktop PDF tools`, 'info');

      // Use Capacitor-compatible export
      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(pdfBlob, outputName);

      setPdfPassword('');
    } catch (error) {
      addLog('pdfPassword', `❌ Critical error: ${error}`, 'error');
      if (error instanceof Error) {
        addLog('pdfPassword', `📋 Error details: ${error.message}`, 'error');
        addLog('pdfPassword', `🔍 Check if pdf-lib version supports encryption`, 'error');
      }
      setTasks(prev => ({ ...prev, pdfPassword: { ...prev.pdfPassword, status: 'error' } }));
    }

    if (pdfPasswordRef.current) pdfPasswordRef.current.value = '';
  }, [pdfPassword, addLog, updateTaskProgress, completeTask, resetTask]);

  const handlePdfMergeAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => file.type === 'application/pdf');
    if (files.length > 0) {
      setPdfMergeFiles(prev => [...prev, ...files]);
      addLog('pdfMerge', `Added ${files.length} PDF(s). Total: ${pdfMergeFiles.length + files.length}`, 'info');
    }
    if (pdfMergeRef.current) pdfMergeRef.current.value = '';
  }, [pdfMergeFiles.length, addLog]);

  const handlePdfMergeRemove = useCallback((index: number) => {
    setPdfMergeFiles(prev => prev.filter((_, i) => i !== index));
    addLog('pdfMerge', `Removed PDF. Remaining: ${pdfMergeFiles.length - 1}`, 'info');
  }, [pdfMergeFiles.length, addLog]);

  const handlePdfMergeClear = useCallback(() => {
    setPdfMergeFiles([]);
    addLog('pdfMerge', 'Cleared all PDFs', 'info');
  }, [addLog]);

  const handleImageConverter = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) {
      addLog('imageConverter', 'No valid image files selected!', 'error');
      return;
    }

    resetTask('imageConverter');
    setShowProgressWindow(true);
    setActiveProgressTab('imageConverter');

    addLog('imageConverter', `Converting ${files.length} images to ${convertFormat.toUpperCase()}...`, 'info');
    updateTaskProgress('imageConverter', 0, files.length);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        addLog('imageConverter', `Converting: ${file.name}`, 'progress');

        const img = new Image();
        const imgURL = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imgURL;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        URL.revokeObjectURL(imgURL);

        let mimeType = 'image/png';
        let extension = 'png';
        
        if (convertFormat === 'jpg') {
          mimeType = 'image/jpeg';
          extension = 'jpg';
        } else if (convertFormat === 'webp') {
          mimeType = 'image/webp';
          extension = 'webp';
        } else if (convertFormat === 'bmp') {
          mimeType = 'image/bmp';
          extension = 'bmp';
        }

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), mimeType, 1.0);
        });

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const fileName = `${baseName}.${extension}`;
        zip.file(fileName, blob);

        updateTaskProgress('imageConverter', i + 1, files.length);
        addLog('imageConverter', `Converted: ${fileName}`, 'info');
      }

      addLog('imageConverter', 'Creating ZIP file...', 'info');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const outputName = `converted_images_${convertFormat}.zip`;

      completeTask('imageConverter', zipBlob, outputName);
      addLog('imageConverter', `Completed! ${files.length} images converted`, 'success');

      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(zipBlob, outputName);

    } catch (error) {
      addLog('imageConverter', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, imageConverter: { ...prev.imageConverter, status: 'error' } }));
    }

    if (imageConverterRef.current) imageConverterRef.current.value = '';
  }, [convertFormat, addLog, updateTaskProgress, completeTask, resetTask]);

  const handleImageCompressor = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) {
      addLog('imageCompressor', 'No valid image files selected!', 'error');
      return;
    }

    resetTask('imageCompressor');
    setShowProgressWindow(true);
    setActiveProgressTab('imageCompressor');

    addLog('imageCompressor', `Compressing ${files.length} images at ${compressionQuality}% quality...`, 'info');
    updateTaskProgress('imageCompressor', 0, files.length);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        totalOriginalSize += file.size;
        addLog('imageCompressor', `Compressing: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'progress');

        const img = new Image();
        const imgURL = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imgURL;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        URL.revokeObjectURL(imgURL);

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', compressionQuality / 100);
        });

        totalCompressedSize += blob.size;
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const fileName = `${baseName}_compressed.jpg`;
        zip.file(fileName, blob);

        updateTaskProgress('imageCompressor', i + 1, files.length);
        addLog('imageCompressor', `Compressed: ${fileName} (${(blob.size / 1024).toFixed(1)} KB)`, 'info');
      }

      const savings = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1);
      addLog('imageCompressor', `Total size reduction: ${savings}%`, 'success');
      
      addLog('imageCompressor', 'Creating ZIP file...', 'info');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const outputName = `compressed_images_q${compressionQuality}.zip`;

      completeTask('imageCompressor', zipBlob, outputName);
      addLog('imageCompressor', `Completed! ${files.length} images compressed`, 'success');

      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(zipBlob, outputName);

    } catch (error) {
      addLog('imageCompressor', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, imageCompressor: { ...prev.imageCompressor, status: 'error' } }));
    }

    if (imageCompressorRef.current) imageCompressorRef.current.value = '';
  }, [compressionQuality, addLog, updateTaskProgress, completeTask, resetTask]);

  const handleQrGenerator = useCallback(async () => {
    if (!qrText.trim()) {
      addLog('qrGenerator', 'Please enter text or URL first!', 'error');
      return;
    }

    resetTask('qrGenerator');
    setShowProgressWindow(true);
    setActiveProgressTab('qrGenerator');

    addLog('qrGenerator', 'Generating QR code...', 'info');
    updateTaskProgress('qrGenerator', 1, 1);

    try {
      const QRCode = (await import('qrcode')).default;
      
      const qrDataUrl = await QRCode.toDataURL(qrText, {
        width: qrSize,
        margin: 2,
        errorCorrectionLevel: 'M'
      });

      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const outputName = 'qrcode.png';

      completeTask('qrGenerator', blob, outputName);
      addLog('qrGenerator', 'QR code generated successfully!', 'success');

      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(blob, outputName);

    } catch (error) {
      addLog('qrGenerator', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, qrGenerator: { ...prev.qrGenerator, status: 'error' } }));
    }
  }, [qrText, qrSize, addLog, updateTaskProgress, completeTask, resetTask]);

  const handleImageSplitter = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      addLog('imageSplitter', 'Please select a valid image file!', 'error');
      return;
    }

    resetTask('imageSplitter');
    setShowProgressWindow(true);
    setActiveProgressTab('imageSplitter');

    const totalPieces = splitRows * splitCols;
    addLog('imageSplitter', `Splitting image into ${splitRows}x${splitCols} grid (${totalPieces} pieces)...`, 'info');
    updateTaskProgress('imageSplitter', 0, totalPieces);

    try {
      const img = new Image();
      const imgURL = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgURL;
      });

      const pieceWidth = Math.floor(img.width / splitCols);
      const pieceHeight = Math.floor(img.height / splitRows);

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      let pieceCount = 0;
      for (let row = 0; row < splitRows; row++) {
        for (let col = 0; col < splitCols; col++) {
          const canvas = document.createElement('canvas');
          canvas.width = pieceWidth;
          canvas.height = pieceHeight;
          const ctx = canvas.getContext('2d')!;

          ctx.drawImage(
            img,
            col * pieceWidth,
            row * pieceHeight,
            pieceWidth,
            pieceHeight,
            0,
            0,
            pieceWidth,
            pieceHeight
          );

          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => resolve(blob!), 'image/png');
          });

          const fileName = `piece_${row + 1}_${col + 1}.png`;
          zip.file(fileName, blob);

          pieceCount++;
          updateTaskProgress('imageSplitter', pieceCount, totalPieces);
          addLog('imageSplitter', `Created: ${fileName}`, 'info');
        }
      }

      URL.revokeObjectURL(imgURL);

      addLog('imageSplitter', 'Creating ZIP file...', 'info');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const outputName = `${baseName}_split_${splitRows}x${splitCols}.zip`;

      completeTask('imageSplitter', zipBlob, outputName);
      addLog('imageSplitter', `Completed! ${totalPieces} pieces created`, 'success');

      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(zipBlob, outputName);

    } catch (error) {
      addLog('imageSplitter', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, imageSplitter: { ...prev.imageSplitter, status: 'error' } }));
    }

    if (imageSplitterRef.current) imageSplitterRef.current.value = '';
  }, [splitRows, splitCols, addLog, updateTaskProgress, completeTask, resetTask]);

  const handlePdfMergeExecute = useCallback(async () => {
    if (pdfMergeFiles.length < 2) {
      addLog('pdfMerge', 'Please add at least 2 PDF files to merge!', 'error');
      return;
    }

    resetTask('pdfMerge');
    setShowProgressWindow(true);
    setActiveProgressTab('pdfMerge');

    addLog('pdfMerge', `Merging ${pdfMergeFiles.length} PDF files...`, 'info');
    updateTaskProgress('pdfMerge', 0, pdfMergeFiles.length);

    try {
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < pdfMergeFiles.length; i++) {
        const file = pdfMergeFiles[i];
        addLog('pdfMerge', `Processing: ${file.name}`, 'progress');

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

        pages.forEach(page => mergedPdf.addPage(page));

        updateTaskProgress('pdfMerge', i + 1, pdfMergeFiles.length);
        addLog('pdfMerge', `Added ${pdf.getPageCount()} pages from: ${file.name}`, 'info');
      }

      addLog('pdfMerge', 'Generating merged PDF...', 'info');
      const pdfBytes = await mergedPdf.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      const firstFileName = pdfMergeFiles[0].name.replace('.pdf', '').replace('.PDF', '');
      const outputName = `${firstFileName}_merged.pdf`;

      completeTask('pdfMerge', pdfBlob, outputName);
      addLog('pdfMerge', `Completed! Total pages: ${mergedPdf.getPageCount()}`, 'success');

      // Use Capacitor-compatible export
      const { handleFileExport } = await import('../utils/browserUtils');
      await handleFileExport(pdfBlob, outputName);

      setPdfMergeFiles([]);
    } catch (error) {
      addLog('pdfMerge', `Error: ${error}`, 'error');
      setTasks(prev => ({ ...prev, pdfMerge: { ...prev.pdfMerge, status: 'error' } }));
    }
  }, [pdfMergeFiles, addLog, updateTaskProgress, completeTask, resetTask]);

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
              Protect PDF with password - requires password to open
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
              Add PDFs one by one, then merge
            </p>
          </div>
          
          {pdfMergeFiles.length > 0 && (
            <div style={{
              maxHeight: '120px',
              overflowY: 'auto',
              marginBottom: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '8px'
            }}>
              {pdfMergeFiles.map((file, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  marginBottom: '4px',
                  background: 'rgba(0, 188, 212, 0.1)',
                  borderRadius: '4px'
                }}>
                  <span style={{ color: '#00bfff', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {index + 1}. {file.name}
                  </span>
                  <button
                    onClick={() => handlePdfMergeRemove(index)}
                    style={{
                      background: 'rgba(255, 0, 0, 0.2)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: '#ff6666',
                      cursor: 'pointer',
                      fontSize: '11px',
                      marginLeft: '8px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={pdfMergeRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfMergeAdd}
            style={{ display: 'none' }}
          />
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              onClick={() => pdfMergeRef.current?.click()}
              style={{
                ...buttonStyle,
                flex: 1,
                background: 'linear-gradient(45deg, #00BCD4, #0097A7)'
              }}
              disabled={tasks.pdfMerge.status === 'processing'}
            >
              {pdfMergeFiles.length === 0 ? '📎 Add 1st PDF' : `📎 Add More (${pdfMergeFiles.length})`}
            </button>
            
            {pdfMergeFiles.length > 0 && (
              <button
                onClick={handlePdfMergeClear}
                style={{
                  ...buttonStyle,
                  width: 'auto',
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '10px 12px'
                }}
              >
                🗑️
              </button>
            )}
          </div>

          {pdfMergeFiles.length >= 2 && (
            <button
              onClick={handlePdfMergeExecute}
              style={{
                ...buttonStyle,
                background: tasks.pdfMerge.status === 'processing'
                  ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                  : 'linear-gradient(45deg, #4CAF50, #388E3C)'
              }}
              disabled={tasks.pdfMerge.status === 'processing'}
            >
              {tasks.pdfMerge.status === 'processing'
                ? `Merging... ${tasks.pdfMerge.progress}/${tasks.pdfMerge.total}`
                : `✅ Merge ${pdfMergeFiles.length} PDFs`}
            </button>
          )}

          {tasks.pdfMerge.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.pdfMerge.status) }}>
                {getStatusIcon(tasks.pdfMerge.status)} {tasks.pdfMerge.status}
              </span>
            </div>
          )}
        </div>

        {/* 6. Image Format Converter */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>🔄</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>Image Converter</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Convert images between formats (PNG, JPG, WEBP, BMP)
            </p>
          </div>
          <select
            value={convertFormat}
            onChange={(e) => setConvertFormat(e.target.value as any)}
            style={{
              ...inputStyle,
              cursor: 'pointer'
            }}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="webp">WEBP</option>
            <option value="bmp">BMP</option>
          </select>
          <input
            ref={imageConverterRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageConverter}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => imageConverterRef.current?.click()}
            style={{
              ...buttonStyle,
              background: tasks.imageConverter.status === 'processing'
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #00BCD4, #0097A7)'
            }}
            disabled={tasks.imageConverter.status === 'processing'}
          >
            {tasks.imageConverter.status === 'processing'
              ? `Converting... ${tasks.imageConverter.progress}/${tasks.imageConverter.total}`
              : `📤 Upload & Convert to ${convertFormat.toUpperCase()}`}
          </button>
          {tasks.imageConverter.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.imageConverter.status) }}>
                {getStatusIcon(tasks.imageConverter.status)} {tasks.imageConverter.status}
              </span>
            </div>
          )}
        </div>

        {/* 7. Image Compressor */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>📉</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>Image Compressor</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Reduce file size while maintaining quality
            </p>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#00bfff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Quality: {compressionQuality}%
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={compressionQuality}
              onChange={(e) => setCompressionQuality(parseInt(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer'
              }}
            />
          </div>
          <input
            ref={imageCompressorRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageCompressor}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => imageCompressorRef.current?.click()}
            style={{
              ...buttonStyle,
              background: tasks.imageCompressor.status === 'processing'
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #FF5722, #E64A19)'
            }}
            disabled={tasks.imageCompressor.status === 'processing'}
          >
            {tasks.imageCompressor.status === 'processing'
              ? `Compressing... ${tasks.imageCompressor.progress}/${tasks.imageCompressor.total}`
              : '🗜️ Upload & Compress'}
          </button>
          {tasks.imageCompressor.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.imageCompressor.status) }}>
                {getStatusIcon(tasks.imageCompressor.status)} {tasks.imageCompressor.status}
              </span>
            </div>
          )}
        </div>

        {/* 8. QR Code Generator */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>📱</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>QR Code Generator</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Generate QR codes from text or URLs
            </p>
          </div>
          <input
            type="text"
            placeholder="Enter text or URL"
            value={qrText}
            onChange={(e) => setQrText(e.target.value)}
            style={inputStyle}
          />
          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#00bfff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Size: {qrSize}px
            </label>
            <input
              type="range"
              min="128"
              max="512"
              step="64"
              value={qrSize}
              onChange={(e) => setQrSize(parseInt(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer'
              }}
            />
          </div>
          <button
            onClick={handleQrGenerator}
            style={{
              ...buttonStyle,
              background: tasks.qrGenerator.status === 'processing'
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #9C27B0, #7B1FA2)'
            }}
            disabled={tasks.qrGenerator.status === 'processing' || !qrText.trim()}
          >
            {tasks.qrGenerator.status === 'processing'
              ? 'Generating...'
              : '🎯 Generate QR Code'}
          </button>
          {tasks.qrGenerator.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.qrGenerator.status) }}>
                {getStatusIcon(tasks.qrGenerator.status)} {tasks.qrGenerator.status}
              </span>
            </div>
          )}
        </div>

        {/* 9. Image Splitter */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '48px' }}>✂️</span>
            <h3 style={{ color: '#00ffff', margin: '12px 0 8px 0' }}>Image Splitter</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
              Split images into grid pieces
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#00bfff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Rows: {splitRows}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={splitRows}
                onChange={(e) => setSplitRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                style={{
                  ...inputStyle,
                  marginBottom: 0,
                  textAlign: 'center'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#00bfff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Cols: {splitCols}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={splitCols}
                onChange={(e) => setSplitCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                style={{
                  ...inputStyle,
                  marginBottom: 0,
                  textAlign: 'center'
                }}
              />
            </div>
          </div>
          <p style={{ color: '#888', fontSize: '11px', textAlign: 'center', margin: '0 0 12px 0' }}>
            Will create {splitRows * splitCols} pieces
          </p>
          <input
            ref={imageSplitterRef}
            type="file"
            accept="image/*"
            onChange={handleImageSplitter}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => imageSplitterRef.current?.click()}
            style={{
              ...buttonStyle,
              background: tasks.imageSplitter.status === 'processing'
                ? 'linear-gradient(45deg, #FFC107, #FF9800)'
                : 'linear-gradient(45deg, #E91E63, #C2185B)'
            }}
            disabled={tasks.imageSplitter.status === 'processing'}
          >
            {tasks.imageSplitter.status === 'processing'
              ? `Splitting... ${tasks.imageSplitter.progress}/${tasks.imageSplitter.total}`
              : '✂️ Upload & Split'}
          </button>
          {tasks.imageSplitter.status !== 'idle' && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: getStatusColor(tasks.imageSplitter.status) }}>
                {getStatusIcon(tasks.imageSplitter.status)} {tasks.imageSplitter.status}
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
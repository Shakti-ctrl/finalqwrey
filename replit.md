# Overview

This is a Progressive Web Application (PWA) for professional-grade batch image processing. The application provides advanced cropping, quality enhancement, watermarking, and digital signature capabilities for images. It's built as a privacy-first, client-side application that processes all images locally without server uploads. The app also includes integrated PDF processing capabilities and a molecular visualization tool (MolView).

The application is designed to work across desktop, tablet, and mobile devices, with support for offline functionality through PWA features and Capacitor for native mobile deployment.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React 18 with TypeScript
- Single-page application (SPA) architecture
- Component-based structure with functional components and hooks
- TypeScript for type safety and better developer experience
- React Router DOM for potential future routing capabilities (currently not actively used)

**UI Components**:
- Main processing interface (`src/pages/Main.tsx`) - Primary user interface
- Cropper component (`src/component/Cropper.tsx`) - Image cropping functionality using react-image-crop
- Quality/Enhancement panels (`src/component/QualityPanel.tsx`, `src/component/AdjustmentsPanel.tsx`) - Image quality controls
- Effect filters (`src/component/EffectFilters.tsx`) - Preset visual filters
- PDF Master (`src/components/PDFMaster.tsx`) - PDF processing capabilities
- Window Manager system (`src/components/WindowManager.tsx`) - Floating window management
- MolView integration (`src/components/MolView.tsx`) - Molecular visualization

**State Management**: 
- Local React state using hooks (useState, useEffect, useRef, useCallback)
- No global state management library; state is managed at component level and passed through props
- Browser localStorage for user preferences (via Preferences object in MolView)

**Styling**:
- Custom CSS with gradient-based cyberpunk/tech aesthetic
- Responsive design with viewport-based sizing
- Google Fonts integration (Orbitron, Rajdhani)
- Dark theme with cyan/blue accent colors

## Progressive Web App (PWA) Features

**Service Worker**: 
- Workbox-based service worker for offline functionality
- Precaching of application shell and assets
- Cache-first strategy with stale-while-revalidate
- App Shell pattern for navigation

**Installation**:
- A2HS (Add to Home Screen) button component
- Web App Manifest configuration for installable app
- Support for both iOS and Android installation
- Standalone display mode

**Offline Support**:
- Full offline functionality after initial load
- Local image processing without server dependency
- Service worker registration in production mode

## Mobile/Native Support

**Capacitor Integration**:
- Android build configuration (`capacitor.config.ts`)
- File system access via Capacitor Filesystem plugin
- Native sharing via Capacitor Share plugin
- Browser plugin for opening URLs in system browser
- Configured for HTTPS scheme on Android

**Mobile-Specific Features**:
- Touch-optimized UI components
- Folder upload support with webkitdirectory attribute
- Device pixel ratio detection for high-DPI displays
- Responsive viewport configuration

## Image Processing Architecture

**Client-Side Processing**:
- Canvas API for image manipulation and rendering
- Async image loading patterns
- In-memory processing using Blob and File APIs
- No server-side processing - complete privacy

**Core Features**:
1. **Batch Operations**: Process 100+ images simultaneously
2. **Cropping**: Pixel-perfect cropping with aspect ratio controls
3. **Quality Enhancement**: CSS filters and canvas-based adjustments
4. **Watermarking**: Text and image overlays with positioning controls
5. **Digital Signatures**: Support for signature elements
6. **Export**: Multiple format support with quality controls

**Processing Flow**:
- File upload → Validation → Preview → Adjustments → Export
- Real-time preview using canvas rendering
- Batch processing with job queue management

## PDF Processing

**Libraries**:
- pdf-lib: PDF creation and manipulation
- pdfjs-dist: PDF rendering and parsing
- jsPDF: Additional PDF generation capabilities

**Features**:
- PDF creation from images
- Page extraction and manipulation
- Range-based page selection
- Window-based PDF management interface

## Additional Integrations

**MolView**:
- Embedded molecular visualization tool
- 3D molecular structure rendering
- Chemical database integration
- Separate build artifacts in public/molview and build/molview directories

**OCR**: 
- Tesseract.js for optical character recognition
- Text extraction from images

**File Handling**:
- JSZip for creating zip archives
- Support for folder imports
- Drag-and-drop file uploads

## Build and Development

**Build Tool**: Create React App (react-scripts)
- Development server with hot reload
- Production build optimization
- TypeScript compilation
- CSS bundling

**Scripts**:
- `npm start`: Development server
- `npm build`: Production build
- Capacitor CLI for mobile builds

**Configuration**:
- TypeScript strict mode enabled
- ES5 target for broad compatibility
- ESNext module system
- React JSX transformation

# External Dependencies

## Core React Ecosystem
- **react** ^18.1.0 - UI framework
- **react-dom** ^18.1.0 - DOM rendering
- **react-scripts** ^5.0.1 - Build tooling and development server
- **typescript** ^4.7.3 - Type safety

## Routing and Navigation
- **react-router-dom** ^6.14.1 - Client-side routing (currently not actively used but available)

## Image Processing
- **react-image-crop** ^9.1.1 - Interactive image cropping interface
- Canvas API (browser native) - Image manipulation and rendering

## PDF Processing
- **jspdf** ^3.0.1 - PDF generation
- **pdf-lib** ^1.17.1 - PDF manipulation and creation
- **pdfjs-dist** ^5.4.54 - PDF parsing and rendering

## File Handling
- **jszip** ^3.10.1 - ZIP archive creation for batch downloads

## OCR (Optical Character Recognition)
- **tesseract.js** ^6.0.1 - Text extraction from images

## PWA Support
- **workbox-*** ^6.6.0 (multiple packages) - Service worker tooling
  - workbox-background-sync
  - workbox-broadcast-update
  - workbox-cacheable-response
  - workbox-core
  - workbox-expiration
  - workbox-google-analytics
  - workbox-navigation-preload
  - workbox-precaching
  - workbox-range-requests
  - workbox-routing
  - workbox-strategies
  - workbox-streams

## Mobile/Native Support
- **@capacitor/core** ^7.4.3 - Cross-platform native runtime
- **@capacitor/cli** ^7.4.3 - Build tools
- **@capacitor/android** ^7.4.3 - Android platform
- **@capacitor/browser** ^7.0.2 - Browser plugin
- **@capacitor/filesystem** ^7.1.5 - File system access
- **@capacitor/share** ^7.0.2 - Native sharing

## Build Tools and Development
- **bower** ^1.8.14 - Package manager (legacy, likely unused)
- **grunt-cli** ^1.5.0 - Task runner (legacy, likely unused)

## Performance Monitoring
- **web-vitals** ^2.1.4 - Performance metrics collection

## Testing
- **@testing-library/react** ^13.3.0 - React testing utilities
- **@testing-library/jest-dom** ^5.16.4 - DOM matchers
- **@testing-library/user-event** ^13.5.0 - User interaction simulation
- **@types/jest** ^27.5.2 - Jest type definitions

## TypeScript Types
- **@types/node** ^16.11.38
- **@types/react** ^18.0.11
- **@types/react-dom** ^18.0.5
- **@types/react-router-dom** ^5.3.3

## External Services and APIs
- No external backend services
- No databases (all processing is client-side)
- Uses browser APIs exclusively:
  - File API
  - Canvas API
  - Service Worker API
  - Web Share API (via Capacitor)
  - Storage API (localStorage)

## Embedded Third-Party Tools
- **MolView** - Molecular visualization platform (embedded as separate app in public/molview)
  - ChemDoodle libraries
  - JSmol integration
  - GLmol rendering engine
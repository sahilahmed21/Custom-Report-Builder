// // frontend/src/app/page.tsx
// "use client"; // <-- Add this MANDATORY directive for App Router Client Components

// import React, { useState, useEffect } from 'react';
// import Head from 'next/head'; // Head component usage might differ slightly in App Router, often placed in layout.tsx

// // Correct component import paths (adjust if your structure differs)
// import AuthButton from './components/AuthButton';
// import { useReportConfig } from './hooks/useReportConfig '; // Ensure path is correct
// import { DraggableMetric } from './components/DraggableMetric'; // Now expects .tsx
// import { DroppableArea } from './components/DroppableArea';   // Now expects .tsx
// import { TimeRangeSelector } from './components/TimeRangeSelector';

// // Shadcn UI imports (ensure these paths match your setup)
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Separator } from '@/components/ui/separator';
// import { X } from 'lucide-react'; // Icon for removing items

// // Dnd-kit imports
// import {
//   DndContext,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   closestCenter,
//   DragEndEvent, // <-- Import the specific event type
// } from '@dnd-kit/core';

// import { Metric } from './types'; // Import your Metric type

// export default function Home() {
//   // --- Auth State ---
//   const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
//   const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
//   const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

//   useEffect(() => {
//     const checkAuth = async () => {
//       setIsLoadingAuth(true);
//       try {
//         const response = await fetch(`${backendUrl}/auth/status`);
//         if (response.ok) {
//           const data = await response.json();
//           setIsAuthenticated(data.isAuthenticated);
//         } else {
//           console.error("Failed to fetch auth status:", response.statusText);
//           setIsAuthenticated(false);
//         }
//       } catch (error) {
//         console.error("Error checking auth status:", error);
//         setIsAuthenticated(false);
//       } finally {
//         setIsLoadingAuth(false);
//       }
//     };

//     const queryParams = new URLSearchParams(window.location.search);
//     const authStatus = queryParams.get('auth_status');
//     if (authStatus === 'success') {
//       setIsAuthenticated(true);
//       setIsLoadingAuth(false);
//       window.history.replaceState({}, document.title, window.location.pathname); // Use pathname
//     } else if (authStatus === 'error') {
//       setIsAuthenticated(false);
//       setIsLoadingAuth(false);
//       const message = queryParams.get('message');
//       alert(`Authentication failed: ${message || 'Unknown error'}`);
//       window.history.replaceState({}, document.title, window.location.pathname);
//     } else {
//       checkAuth();
//     }
//   }, [backendUrl]);

//   const handleLogout = async () => {
//     setIsLoadingAuth(true);
//     try {
//       const response = await fetch(`${backendUrl}/auth/logout`, { method: 'POST' });
//       if (response.ok) {
//         setIsAuthenticated(false);
//         alert('Logged out successfully.');
//       } else {
//         const data = await response.json();
//         console.error("Logout failed:", data.error || response.statusText);
//         alert(`Logout failed: ${data.error || 'Please try again.'}`);
//       }
//     } catch (error) {
//       console.error("Error during logout:", error);
//       alert('An error occurred during logout.');
//     } finally {
//       setIsLoadingAuth(false);
//     }
//   };
//   // --- End Auth State ---

//   // --- Report Config State ---
//   const {
//     availableMetrics,
//     selectedMetrics,
//     selectedTimeRange,
//     timeRanges, // <-- Use this one from the hook
//     setSelectedTimeRange,
//     handleDragEnd: handleDragEndFromHook, // Rename to avoid conflict if needed
//     removeSelectedMetric,
//   } = useReportConfig();

//   // Type the drag end handler
//   const handleDragEnd = (event: DragEndEvent) => {
//     handleDragEndFromHook(event); // Call the handler from the hook
//   };

//   // Setup dnd-kit sensors
//   const sensors = useSensors(
//     useSensor(PointerSensor),
//     useSensor(KeyboardSensor)
//   );

//   const handleGenerateReport = () => {
//     // Ensure metrics are actually Metric objects before mapping
//     const metricNames = selectedMetrics.map((m: Metric) => m.name).join(', ');
//     console.log("Generating report with:", {
//       metrics: selectedMetrics,
//       timeRange: selectedTimeRange
//     });
//     alert(`Report Config:\nMetrics: ${metricNames}\nTime Range: ${selectedTimeRange}`);
//     // TODO: Call the backend API using fetchReport.js (from Step 6)
//   };

//   // REMOVED the local timeRanges definition here

//   return (
//     // Wrap with a fragment or single div if Head causes issues here in App Router
//     <>
//       <Head>
//         <title>Custom GSC Report Builder</title>
//         <link rel="icon" href="/favicon.ico" />
//       </Head>
//       <div className="min-h-screen bg-background text-foreground"> {/* Use Shadcn theme colors */}

//         <header className="flex justify-between items-center p-4 border-b">
//           <h1 className="text-2xl font-semibold">
//             Custom Report Builder
//           </h1>
//           <AuthButton
//             isAuthenticated={isAuthenticated}
//             onLogout={handleLogout}
//             isLoading={isLoadingAuth}
//           />
//         </header>

//         <main className="p-4 md:p-8">
//           {isLoadingAuth ? (
//             <p className="text-center">Loading authentication status...</p>
//           ) : !isAuthenticated ? (
//             <Card className="max-w-md mx-auto mt-10">
//               <CardHeader>
//                 <CardTitle>Welcome!</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <p className="text-muted-foreground">Please log in using the button in the header to access the report builder.</p>
//               </CardContent>
//             </Card>
//           ) : (
//             // --- Dnd Context ---
//             <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
//               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

//                 {/* Column 1: Available Metrics & Time Range */}
//                 <div className="space-y-6">
//                   <Card>
//                     <CardHeader>
//                       <CardTitle>Available Metrics</CardTitle>
//                     </CardHeader>
//                     <CardContent className="flex flex-wrap gap-2">
//                       {availableMetrics.map((metric: Metric) => ( // Add type hint
//                         <DraggableMetric key={metric.id} id={metric.id} metric={metric} origin="available" />
//                       ))}
//                     </CardContent>
//                   </Card>

//                   <TimeRangeSelector
//                     value={selectedTimeRange}
//                     onChange={setSelectedTimeRange}
//                     timeRanges={timeRanges} // Pass the hook's timeRanges
//                   />
//                 </div>

//                 {/* Column 2: Selected Metrics (Droppable Area) */}
//                 <div className="md:col-span-2 space-y-6">
//                   <DroppableArea id="selected-metrics-area" title="Selected Metrics">
//                     {/* Display selected metrics */}
//                     {selectedMetrics.length > 0 ? (
//                       <div className="flex flex-wrap gap-2">
//                         {selectedMetrics.map((metric: Metric) => ( // Add type hint
//                           <div key={metric.id} className="relative group">
//                             <DraggableMetric id={metric.id} metric={metric} origin="selected-metrics-area" />
//                             <button
//                               onClick={() => removeSelectedMetric(metric.id)}
//                               className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
//                               aria-label={`Remove ${metric.name}`}
//                             >
//                               <X size={12} />
//                             </button>
//                           </div>
//                         ))}
//                       </div>
//                     ) : null /* Placeholder text is handled within DroppableArea */}
//                   </DroppableArea>

//                   <Separator />

//                   <div className="flex justify-end">
//                     <Button
//                       onClick={handleGenerateReport}
//                       disabled={selectedMetrics.length === 0}
//                     >
//                       Generate Report
//                     </Button>
//                   </div>

//                   {/* Placeholder for ReportTable (Step 8) */}
//                   <div className="mt-6">
//                     <h3 className="text-xl font-semibold mb-3">Report Results</h3>
//                     <Card>
//                       <CardContent className="p-6 text-center text-muted-foreground">
//                         Report data will appear here...
//                       </CardContent>
//                     </Card>
//                   </div>
//                 </div>
//               </div>
//             </DndContext>
//           )}
//         </main>

//         <footer className="mt-12 p-4 text-center text-muted-foreground text-sm border-t">
//           Powered by Next.js, Node.js, GSC API, and Gemini API
//         </footer>
//       </div>
//     </>
//   );
// }
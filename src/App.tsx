/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Subject from './pages/Subject';
import TaskRouter from './pages/TaskRouter';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subjects/:id" element={<Subject />} />
          <Route path="/tasks/:id" element={<TaskRouter />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

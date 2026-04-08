'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, MessageSquare, Bell, Search, Send, Plus, Settings,
  ChevronDown, Circle, AlertTriangle, CheckCircle2, Clock,
  Bot, User, Zap, BarChart3, Target, Mail, Globe, Brain,
  Lightbulb, Share2, TrendingUp, DollarSign, Users, ArrowRight,
  Command, Filter, Pin, Bookmark, MoreHorizontal, Smile,
  AtSign, Paperclip, Mic, ChevronRight, Activity, Star,
  Layout, ListTodo, RefreshCw
} from 'lucide-react';

interface Agent {
  id: string; name: string; role: string; description: string;
  status: 'active' | 'idle' | 'error' | 'running';
  color: string; icon: string; tools: string[];
  schedule?: string; last_run_at?: string;
}
interface AgentLog { id: number; agent_id: string; action: string; details: Record<string, any>; status: string; created_at: string; }
interface AgentTask { id: number; agent_id: string; title: string; description: string; status: string; priority: string; created_at: string; }
interface Channel { id: string; name: string; icon: React.ReactNode; description: string; unread: number; type: 'channel' | 'agent' | 'system'; agentId?: string; }
interface ChatMessage { id: string; sender: string; senderType: 'agent' | 'system' | 'user'; avatar: string; content: string; timestamp: string; channel: string; details?: Record<string, any>; alerts?: string[]; tasks?: string[]; }

const SUPABASE_URL = 'https://kocvqzcxycwzoftcsxch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvY3ZxemN4eWN3em9mdGNzeGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjU1MTksImV4cCI6MjA5MTIwMTUxOX0.a5RQvI1rCQQI7mO8jyxWzn7yhZ49ZCbeTGlLcVWTfQ0';

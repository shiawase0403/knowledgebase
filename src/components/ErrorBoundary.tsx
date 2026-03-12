import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <div>
            <h3 className="text-lg font-bold text-red-800">出错了</h3>
            <p className="text-sm text-red-600 mt-1">组件渲染遇到问题。</p>
            <p className="text-xs text-red-400 mt-2 font-mono bg-white p-2 rounded border border-red-100 max-w-md overflow-auto">
              {this.state.error?.message}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="border-red-200 text-red-700 hover:bg-red-100"
          >
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

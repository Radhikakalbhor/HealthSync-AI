'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function DocumentRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/documents/${params.id}/review`);
    } else {
      router.replace('/documents');
    }
  }, [params, router]);

  return (
    <div className="p-16 text-center">
      <div className="w-8 h-8 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-xs text-navy-500">Redirecting to document review...</p>
    </div>
  );
}

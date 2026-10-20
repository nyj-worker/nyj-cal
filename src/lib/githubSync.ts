export const GITHUB_OWNER = 'nyj-worker';
export const GITHUB_REPO = 'nyj-cal';
export const GITHUB_BRANCH = 'main';
export const GITHUB_FOLDER = 'event';
export const TOKEN_STORAGE_KEY = 'nyj_cal_github_token';

export function getStoredGitHubToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredGitHubToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function removeStoredGitHubToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export async function validateGitHubToken(token: string): Promise<{ valid: boolean; login?: string; error?: string }> {
  const clean = token.trim();
  if (!clean) return { valid: false, error: '토큰을 입력해 주세요.' };
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${clean}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) {
      if (res.status === 401) {
        return { valid: false, error: '유효하지 않은 GitHub 토큰입니다. 다시 확인해 주세요.' };
      }
      return { valid: false, error: `GitHub 인증 오류 (상태 코드: ${res.status})` };
    }
    const data = (await res.json()) as { login?: string };
    return { valid: true, login: data.login };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : 'GitHub 연결 실패' };
  }
}

export async function checkGitHubFile(
  token: string,
  filename: string,
): Promise<{ exists: boolean; sha?: string; size?: number }> {
  const cleanToken = token.trim();
  const cleanName = filename.trim();
  if (!cleanName) return { exists: false };

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FOLDER}/${encodeURIComponent(cleanName)}?ref=${GITHUB_BRANCH}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (cleanToken) {
    headers.Authorization = `Bearer ${cleanToken}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (res.status === 404) {
      return { exists: false };
    }
    if (!res.ok) {
      return { exists: false };
    }
    const data = (await res.json()) as { sha?: string; size?: number };
    return { exists: true, sha: data.sha, size: data.size };
  } catch {
    return { exists: false };
  }
}

export async function uploadFileToGitHub(
  token: string,
  filename: string,
  contentBase64: string,
  sha?: string,
): Promise<{ success: boolean; commitSha?: string; htmlUrl?: string; error?: string }> {
  const cleanToken = token.trim();
  const cleanName = filename.trim();
  if (!cleanToken) {
    return { success: false, error: 'GitHub 토큰이 설정되지 않았습니다. 토큰을 등록해 주세요.' };
  }
  if (!cleanName) {
    return { success: false, error: '파일명이 필요합니다.' };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FOLDER}/${encodeURIComponent(cleanName)}`;
  const message = sha
    ? `chore(event): 주간행사 파일 갱신 (${cleanName})`
    : `feat(event): 주간행사 파일 업로드 (${cleanName})`;

  const payload: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message,
    content: contentBase64,
    branch: GITHUB_BRANCH,
  };

  if (sha) {
    payload.sha = sha;
  }

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.status === 409) {
        return { success: false, error: 'GitHub 저장소와 충돌이 발생했습니다. 새로고침 후 다시 시도해 주세요.' };
      }
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: 'GitHub 권한이 부족합니다. 토큰에 repo 쓰기 권한이 있는지 확인해 주세요.' };
      }
      return { success: false, error: errData?.message || `GitHub 업로드 실패 (HTTP ${res.status})` };
    }

    const data = (await res.json()) as { commit?: { sha?: string; html_url?: string } };
    return {
      success: true,
      commitSha: data.commit?.sha,
      htmlUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${GITHUB_FOLDER}/${encodeURIComponent(cleanName)}`,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'GitHub 서버 통신 중 오류가 발생했습니다.' };
  }
}

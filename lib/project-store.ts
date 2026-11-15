// 프로젝트 저장소 경계. 지금은 이 기기(IndexedDB)만 쓴다.
//
// 앞으로의 계획(아직 만들지 않음):
// - 로그인하면 프로젝트 JSON(쓴 획·자모 나누기·설정, 수 MB 이하)을 계정에 올려
//   다른 컴퓨터·휴대폰·태블릿에서 이어서 작업한다. → RemoteProjectStore 를 이 인터페이스로 구현.
// - 폰트 조합·생성은 나중에 서버에서 계산하고 파일만 내려준다(조합 로직 보호).
//   지금은 lib/font/build-client.ts 가 이 기기의 작업자(worker)에서 계산한다.
// 화면 코드는 lib/storage.ts 대신 이 인터페이스를 통해 저장하도록 옮겨 가면,
// 계정 저장을 붙일 때 화면을 고치지 않아도 된다.
import type { FontProject } from "./types";
import {
  deleteProject,
  listProjects,
  loadProject,
  parseProject,
  saveProject,
} from "./storage";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  count: number;
}

export interface ProjectStore {
  /** 마지막으로 연 프로젝트 */
  loadActive(): Promise<FontProject | undefined>;
  save(project: FontProject): Promise<void>;
  list(): Promise<ProjectSummary[]>;
  remove(id: string): Promise<void>;
  /** 계정·파일로 옮길 때 쓰는 JSON(백업 파일과 같은 형식) */
  toJSON(project: FontProject): string;
  fromJSON(text: string): FontProject;
}

/** 이 기기(브라우저 저장소·앱 저장소) */
export const localProjectStore: ProjectStore = {
  loadActive: loadProject,
  save: saveProject,
  list: listProjects,
  remove: async (id) => {
    await deleteProject(id);
  },
  toJSON: (project) => JSON.stringify(project),
  fromJSON: parseProject,
};

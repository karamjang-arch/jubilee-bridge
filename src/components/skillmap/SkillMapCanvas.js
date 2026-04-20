'use client';

import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
// CSS is imported in the parent page

import SubjectClusterNode from '@/components/skillmap/SubjectClusterNode';
import ClusterNode from '@/components/skillmap/ClusterNode';
import ConceptNode from '@/components/skillmap/ConceptNode';
import ConceptPanel from '@/components/ConceptPanel';
import { SUBJECTS as DEFAULT_SUBJECTS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';
import { useConceptProgress } from '@/hooks/useConceptProgress';

// 커스텀 노드 타입
const nodeTypes = {
  subjectCluster: SubjectClusterNode,
  cluster: ClusterNode,
  concept: ConceptNode,
};

// 초기 엣지: 교차 과목 관계
const crossSubjectEdges = [
  { id: 'physics-math', source: 'physics', target: 'math', animated: true, style: { stroke: 'var(--subj-physics)', strokeDasharray: '5,5' } },
  { id: 'chemistry-physics', source: 'chemistry', target: 'physics', animated: true, style: { stroke: 'var(--subj-chemistry)', strokeDasharray: '5,5' } },
  { id: 'chemistry-math', source: 'chemistry', target: 'math', animated: true, style: { stroke: 'var(--subj-chemistry)', strokeDasharray: '5,5' } },
  { id: 'biology-chemistry', source: 'biology', target: 'chemistry', animated: true, style: { stroke: 'var(--subj-biology)', strokeDasharray: '5,5' } },
  { id: 'economics-math', source: 'economics', target: 'math', animated: true, style: { stroke: 'var(--subj-economics)', strokeDasharray: '5,5' } },
  { id: 'cs-math', source: 'cs', target: 'math', animated: true, style: { stroke: 'var(--subj-cs)', strokeDasharray: '5,5' } },
];

// 폴백 클러스터 데이터 (US)
const fallbackClusters = {
  math: ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Number Theory', 'Trigonometry'],
  english: ['Reading Comprehension', 'Vocabulary', 'Grammar', 'Writing', 'Literature'],
  physics: ['Mechanics', 'Thermodynamics', 'Electromagnetism', 'Optics', 'Modern Physics'],
  chemistry: ['Organic', 'Inorganic', 'Physical Chemistry', 'Biochemistry'],
  biology: ['Cell Biology', 'Genetics', 'Ecology', 'Anatomy', 'Evolution'],
  history: ['World History', 'US History', 'European History', 'Ancient Civilizations'],
  economics: ['Microeconomics', 'Macroeconomics', 'International Trade'],
  cs: ['Programming', 'Data Structures', 'Algorithms', 'Databases', 'Networks'],
  // 한국 과목 폴백
  'kr-math': ['중학수학', '고등수학', '수학I', '수학II', '확률과 통계', '미적분'],
  'kr-english': ['독해', '문법', '어휘', '듣기', '쓰기'],
  'kr-korean': ['문학', '독서', '화법과 작문', '언어와 매체'],
  'kr-history': ['한국사', '전근대사', '근현대사'],
  'kr-society': ['사회문화', '정치와 법', '경제'],
  'kr-ethics': ['생활과 윤리', '윤리와 사상'],
  'kr-physics': ['물리I', '물리II', '중학과학'],
  'kr-chemistry': ['화학I', '화학II', '중학과학'],
  'kr-biology': ['생명과학I', '생명과학II', '중학과학'],
  'kr-earth-science': ['지구과학I', '지구과학II', '중학과학'],
};

export default function SkillMapCanvas({ initialData, curriculum = 'us', subjects: propSubjects, initialConceptId }) {
  // 교육과정별 과목 사용 (props 우선, 없으면 기본값)
  const SUBJECTS = propSubjects || DEFAULT_SUBJECTS;
  const isKoreanCurriculum = curriculum === 'kr';

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewLevel, setViewLevel] = useState('subjects');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [conceptsData, setConceptsData] = useState(initialData || null);
  const [gradeFilter, setGradeFilter] = useState('all'); // all, elementary (K-4), middle (5-8), high (9-12)
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  // 재귀 진단 스택: [{conceptId, title, subject, concept}...]
  const [diagnosisStack, setDiagnosisStack] = useState([]);

  // 튜터 세션 데이터: { concept_id: { sessions: number, hasMisconception: boolean } }
  const [tutorData, setTutorData] = useState({});

  // 프로필 & 학습 진행 상태
  const { profile, isAdmin, studentId } = useProfile();
  const { getConceptStatus, markMastered, resetAllProgress } = useConceptProgress(studentId || 'guest');

  // 튜터 세션 데이터 로드
  useEffect(() => {
    if (!studentId) return;

    fetch(`/api/concept-history?student_id=${studentId}&event_type=tutor_session&limit=500`)
      .then(r => r.json())
      .then(data => {
        if (data.events) {
          const tutorMap = {};
          data.events.forEach(event => {
            const conceptId = event.concept_id;
            if (!conceptId) return;

            if (!tutorMap[conceptId]) {
              tutorMap[conceptId] = {
                sessions: 0,
                hasMisconception: false,
                misconceptions: [],
              };
            }
            tutorMap[conceptId].sessions += 1;

            // 오개념 확인
            if (event.detail?.misconceptions?.length > 0) {
              tutorMap[conceptId].hasMisconception = true;
              tutorMap[conceptId].misconceptions.push(...event.detail.misconceptions);
            }
          });
          setTutorData(tutorMap);
        }
      })
      .catch(err => console.error('Failed to load tutor data:', err));
  }, [studentId]);

  // URL에서 개념 ID가 전달된 경우 자동으로 패널 열기
  useEffect(() => {
    if (!initialConceptId || isLoading) return;
    // 약간의 딜레이 후 실행 (canvas 렌더 완료 후)
    const timer = setTimeout(() => {
      handleConceptClick(initialConceptId, null);
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConceptId, isLoading]);

  // 선수개념으로 재귀 이동
  const handleNavigateToPrereq = useCallback(async (prereqId, prereqTitle) => {
    // 현재 개념을 스택에 저장
    const currentEntry = {
      conceptId: selectedConcept.concept_id || selectedConcept.id,
      title: selectedConcept.title_ko || selectedConcept.title_en,
      subject: selectedSubject,
      concept: selectedConcept,
    };
    setDiagnosisStack(prev => [...prev, currentEntry]);

    // 선수개념 데이터 로드
    try {
      const [conceptRes, metaRes] = await Promise.all([
        fetch(`/api/concept-content?id=${prereqId}`),
        fetch(`/api/concepts?id=${prereqId}`),
      ]);
      const contentData = await conceptRes.json();
      const metaData = await metaRes.json();

      const newConcept = {
        concept_id: prereqId,
        id: prereqId,
        title_en: contentData.title_en || metaData.concept?.title_en,
        title_ko: contentData.title_ko || metaData.concept?.title_ko,
        cluster: metaData.concept?.cluster,
        grade_us: metaData.concept?.grade_us,
        prerequisites: metaData.concept?.prerequisites || [],
        ...metaData.concept,
      };

      // 과목 찾기
      const prereqSubject = metaData.subject
        ? SUBJECTS.find(s => s.id === metaData.subject)
        : selectedSubject;

      setSelectedConcept(newConcept);
      if (prereqSubject) setSelectedSubject(prereqSubject);
    } catch (error) {
      console.error('Failed to load prerequisite concept:', error);
    }
  }, [selectedConcept, selectedSubject]);

  // 스택에서 이전 개념으로 돌아가기
  const handleGoBack = useCallback((targetIndex) => {
    const targetEntry = diagnosisStack[targetIndex];
    if (!targetEntry) return;

    // 스택에서 해당 위치까지만 남기고 자르기
    setDiagnosisStack(prev => prev.slice(0, targetIndex));

    // 해당 개념으로 복원
    setSelectedConcept(targetEntry.concept);
    setSelectedSubject(targetEntry.subject);
  }, [diagnosisStack]);

  // 패널 닫을 때 스택 초기화
  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    setSelectedConcept(null);
    setDiagnosisStack([]);
  }, []);

  // CB 데이터 로드 (initialData가 없을 경우만)
  useEffect(() => {
    if (initialData) {
      // initialData가 있으면 바로 노드 생성
      const subjectNodes = SUBJECTS.map((subject, index) => {
        const angle = (index / SUBJECTS.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 300;
        const subjectData = initialData.subjects?.find(s => s.id === subject.id);
        return {
          id: subject.id,
          type: 'subjectCluster',
          position: {
            x: 400 + Math.cos(angle) * radius,
            y: 400 + Math.sin(angle) * radius,
          },
          data: {
            subject,
            mastered: 0,
            total: subjectData?.count || subject.count,
          },
        };
      });
      setNodes(subjectNodes);
      setEdges(isKoreanCurriculum ? [] : crossSubjectEdges);
      setIsLoading(false);
      return;
    }

    const loadConcepts = async () => {
      try {
        const res = await fetch(`/api/concepts?summary=true&curriculum=${curriculum}`);
        const data = await res.json();
        setConceptsData(data);

        // 초기 노드 생성 (8개 과목 클러스터)
        const subjectNodes = SUBJECTS.map((subject, index) => {
          const angle = (index / SUBJECTS.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 300;
          const subjectData = data.subjects?.find(s => s.id === subject.id);
          return {
            id: subject.id,
            type: 'subjectCluster',
            position: {
              x: 400 + Math.cos(angle) * radius,
              y: 400 + Math.sin(angle) * radius,
            },
            data: {
              subject,
              mastered: 0,
              total: subjectData?.count || subject.count,
            },
          };
        });

        setNodes(subjectNodes);
        setEdges(isKoreanCurriculum ? [] : crossSubjectEdges);
      } catch (err) {
        console.error('Failed to load concepts:', err);
        setError(`데이터 로드 실패: ${err.message}`);
        // 폴백: 기본 SUBJECTS 데이터 사용
        const fallbackNodes = SUBJECTS.map((subject, index) => {
          const angle = (index / SUBJECTS.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 300;
          return {
            id: subject.id,
            type: 'subjectCluster',
            position: {
              x: 400 + Math.cos(angle) * radius,
              y: 400 + Math.sin(angle) * radius,
            },
            data: {
              subject,
              mastered: 0,
              total: subject.count,
            },
          };
        });
        setNodes(fallbackNodes);
        setEdges(isKoreanCurriculum ? [] : crossSubjectEdges);
      } finally {
        setIsLoading(false);
      }
    };

    loadConcepts();
  }, [setNodes, setEdges, initialData, curriculum, SUBJECTS]);

  // 과목 클릭 → 클러스터 뷰로 전환
  const handleSubjectClick = useCallback(async (subjectId) => {
    const subject = SUBJECTS.find(s => s.id === subjectId);
    if (!subject) return;

    setSelectedSubject(subject);
    setViewLevel('clusters');

    try {
      const res = await fetch(`/api/concepts?subject=${subjectId}&curriculum=${curriculum}`);
      const data = await res.json();

      let clusters = [];

      if (data.clusters && Object.keys(data.clusters).length > 0) {
        clusters = Object.entries(data.clusters).map(([name, info]) => ({
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          count: info.count || 50,
        }));
      } else {
        clusters = (fallbackClusters[subjectId] || ['General']).map(name => ({
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          count: Math.floor(subject.count / 5),
        }));
      }

      const clusterNodes = clusters.slice(0, 12).map((cluster, index) => {
        const angle = (index / Math.min(clusters.length, 12)) * 2 * Math.PI - Math.PI / 2;
        const radius = 220;
        return {
          id: `${subjectId}-${cluster.id}`,
          type: 'cluster',
          position: {
            x: 400 + Math.cos(angle) * radius,
            y: 400 + Math.sin(angle) * radius,
          },
          data: {
            cluster,
            subject,
            mastered: 0,
          },
        };
      });

      setNodes(clusterNodes);
      setEdges([]);
    } catch (error) {
      console.error('Failed to load clusters:', error);
      const clusters = (fallbackClusters[subjectId] || ['General']).map(name => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        count: Math.floor(subject.count / 5),
      }));

      const clusterNodes = clusters.map((cluster, index) => {
        const angle = (index / clusters.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 220;
        return {
          id: `${subjectId}-${cluster.id}`,
          type: 'cluster',
          position: {
            x: 400 + Math.cos(angle) * radius,
            y: 400 + Math.sin(angle) * radius,
          },
          data: {
            cluster,
            subject,
            mastered: 0,
          },
        };
      });

      setNodes(clusterNodes);
      setEdges([]);
    }
  }, [setNodes, setEdges, curriculum, SUBJECTS]);

  // 학년 범위 필터 함수
  const filterByGrade = useCallback((concepts) => {
    if (gradeFilter === 'all') return concepts;
    const gradeRanges = {
      elementary: [0, 1, 2, 3, 4], // K-4
      middle: [5, 6, 7, 8],
      high: [9, 10, 11, 12],
    };
    const range = gradeRanges[gradeFilter];
    if (!range) return concepts;
    return concepts.filter(c => {
      // 한국 과목은 grade_kr 사용, US는 grade_us 사용
      const grades = c.grade_kr || c.grade_us || [];
      return grades.some(g => range.includes(g));
    });
  }, [gradeFilter]);

  // 클러스터 클릭 → 개념 뷰로 전환
  const handleClusterClick = useCallback(async (clusterId, cluster, subject) => {
    if (!cluster || !subject) return;

    setSelectedCluster(cluster);
    setViewLevel('concepts');

    try {
      const res = await fetch(`/api/concepts?subject=${subject.id}&cluster=${encodeURIComponent(cluster.name)}&curriculum=${curriculum}`);
      const data = await res.json();

      const concepts = filterByGrade(data.concepts || []);

      const conceptNodes = concepts.slice(0, 20).map((concept, index) => {
        const cols = 5;
        const row = Math.floor(index / cols);
        const col = index % cols;
        const status = getConceptStatus(
          concept.id,
          subject.id,
          concept.prerequisites || []
        );

        // 튜터 데이터 조회
        const conceptTutorData = tutorData[concept.id] || { sessions: 0, hasMisconception: false };

        return {
          id: concept.id,
          type: 'concept',
          position: {
            x: 100 + col * 140,
            y: 150 + row * 110,
          },
          data: {
            concept: {
              ...concept,
              title: concept.title_en || 'Concept',
              status,
            },
            subject,
            status,
            tutorSessions: conceptTutorData.sessions,
            hasMisconception: conceptTutorData.hasMisconception,
          },
        };
      });

      const conceptEdges = [];
      concepts.forEach((concept) => {
        if (concept.prerequisites) {
          concept.prerequisites.forEach(prereqId => {
            const prereqExists = concepts.find(c => c.id === prereqId);
            if (prereqExists) {
              conceptEdges.push({
                id: `${prereqId}-${concept.id}`,
                source: prereqId,
                target: concept.id,
                style: { stroke: `var(${subject.cssVar})` },
                markerEnd: { type: MarkerType.ArrowClosed },
              });
            }
          });
        }
      });

      setNodes(conceptNodes);
      setEdges(conceptEdges);
    } catch (error) {
      console.error('Failed to load concepts:', error);
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges, getConceptStatus, filterByGrade, curriculum, tutorData]);

  // 개념 클릭 → 상세 패널 열기
  const handleConceptClick = useCallback(async (conceptId, concept) => {
    try {
      const res = await fetch(`/api/concepts?id=${conceptId}`);
      const data = await res.json();

      if (data.concept) {
        setSelectedConcept({
          ...data.concept,
          concept_id: conceptId,
          cluster: selectedCluster?.name || 'Unknown',
        });
      } else {
        setSelectedConcept({
          ...concept,
          concept_id: conceptId,
          title_en: concept?.title || 'Concept',
          title_ko: (concept?.title || 'Concept') + ' (한국어)',
          cluster: selectedCluster?.name || 'Unknown',
          grade_us: [9, 10],
          sat_domain: 'Unknown',
          sat_skill: 'Unknown',
          learning_pathways: {},
          diagnostic_questions: [],
          common_errors: [],
        });
      }
      setPanelOpen(true);
    } catch (error) {
      console.error('Failed to load concept details:', error);
    }
  }, [selectedCluster]);

  // 뒤로 가기
  const handleBack = useCallback(() => {
    if (viewLevel === 'concepts') {
      if (selectedSubject) {
        handleSubjectClick(selectedSubject.id);
      }
    } else if (viewLevel === 'clusters') {
      setViewLevel('subjects');
      setSelectedSubject(null);
      setSelectedCluster(null);

      const subjectNodes = SUBJECTS.map((subject, index) => {
        const angle = (index / SUBJECTS.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 300;
        const subjectData = conceptsData?.subjects?.find(s => s.id === subject.id);
        return {
          id: subject.id,
          type: 'subjectCluster',
          position: {
            x: 400 + Math.cos(angle) * radius,
            y: 400 + Math.sin(angle) * radius,
          },
          data: {
            subject,
            mastered: 0,
            total: subjectData?.count || subject.count,
          },
        };
      });

      setNodes(subjectNodes);
      setEdges(isKoreanCurriculum ? [] : crossSubjectEdges);
    }
  }, [viewLevel, selectedSubject, handleSubjectClick, setNodes, setEdges, conceptsData, isKoreanCurriculum]);

  // 노드 클릭 핸들러
  const onNodeClick = useCallback((event, node) => {
    if (!node?.data) return;

    if (node.type === 'subjectCluster') {
      handleSubjectClick(node.id);
    } else if (node.type === 'cluster') {
      handleClusterClick(node.id, node.data.cluster, node.data.subject);
    } else if (node.type === 'concept') {
      handleConceptClick(node.id, node.data.concept);
    }
  }, [handleSubjectClick, handleClusterClick, handleConceptClick]);

  // 미니맵 색상
  const nodeColor = useCallback((node) => {
    if (!node?.data) return '#ccc';

    if (node.type === 'subjectCluster' && node.data.subject?.cssVar) {
      return `var(${node.data.subject.cssVar})`;
    }
    if (node.type === 'cluster' && node.data.subject?.cssVar) {
      return `var(${node.data.subject.cssVar})`;
    }
    if (node.type === 'concept') {
      if (node.data.status === 'mastered') return 'var(--success)';
      if (node.data.status === 'available' && node.data.subject?.cssVar) {
        return `var(${node.data.subject.cssVar})`;
      }
      return 'var(--progress-locked)';
    }
    return '#ccc';
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-danger text-lg mb-4">스킬맵 로드 실패</div>
        <div className="text-text-secondary text-sm bg-bg-sidebar p-4 rounded-lg max-w-lg">
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-subj-math text-white rounded-lg"
        >
          새로고침
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-tertiary">CB 데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      {/* 뷰 컨트롤 */}
      <div className="px-6 py-3 bg-bg-card border-b border-border-subtle flex items-center gap-4">
        {viewLevel !== 'subjects' && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-ui text-text-secondary hover:text-text-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            뒤로
          </button>
        )}

        {/* 학년 필터 */}
        <div className="flex items-center gap-1 bg-bg-sidebar rounded-lg p-1">
          {[
            { id: 'all', label: '전체' },
            { id: 'elementary', label: 'K-4' },
            { id: 'middle', label: '5-8' },
            { id: 'high', label: '9-12' },
          ].map(g => (
            <button
              key={g.id}
              onClick={() => setGradeFilter(g.id)}
              className={`px-3 py-1 text-caption rounded-md transition-colors ${
                gradeFilter === g.id
                  ? 'bg-bg-card text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-pill text-caption ${viewLevel === 'subjects' ? 'bg-subj-math-light text-subj-math' : 'text-text-tertiary'}`}
          >
            전체 ({conceptsData?.totalCount?.toLocaleString() || '4,351'})
          </span>
          {selectedSubject && (
            <>
              <span className="text-text-disabled">/</span>
              <span
                className="px-3 py-1 rounded-pill text-caption"
                style={{
                  backgroundColor: viewLevel !== 'subjects' ? `var(${selectedSubject.cssVar}-light)` : undefined,
                  color: `var(${selectedSubject.cssVar}-dark)`,
                }}
              >
                {selectedSubject.name}
              </span>
            </>
          )}
          {selectedCluster && (
            <>
              <span className="text-text-disabled">/</span>
              <span
                className="px-3 py-1 rounded-pill text-caption"
                style={{
                  backgroundColor: `var(${selectedSubject.cssVar}-light)`,
                  color: `var(${selectedSubject.cssVar}-dark)`,
                }}
              >
                {selectedCluster.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* React Flow 캔버스 */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Background color="var(--border-subtle)" gap={20} />
          <Controls className="!bg-bg-card !border-border-subtle !rounded-lg !shadow-card" />
          <MiniMap
            nodeColor={nodeColor}
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-bg-card !border-border-subtle !rounded-lg !shadow-card"
            style={{ width: 120, height: 80 }}
          />
        </ReactFlow>

        {/* 개념 상세 패널 */}
        {panelOpen && selectedConcept && (
          <ConceptPanel
            concept={selectedConcept}
            subject={selectedSubject}
            status={getConceptStatus(
              selectedConcept.concept_id || selectedConcept.id,
              selectedSubject?.id,
              selectedConcept.prerequisites || []
            )}
            onMastered={markMastered}
            onClose={handleClosePanel}
            diagnosisStack={diagnosisStack}
            onNavigateToPrereq={handleNavigateToPrereq}
            onGoBack={handleGoBack}
          />
        )}
      </div>
    </>
  );
}

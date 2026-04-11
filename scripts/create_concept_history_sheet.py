#!/usr/bin/env python3
"""
concept_history Google Sheets 탭 생성 스크립트
- 기존 Sheets에 concept_history 탭 추가
- 헤더행 자동 생성
"""

import os
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# Sheets 설정
SPREADSHEET_ID = '1gcCoEC0LvKTefu8FW6V90T20WZ0l1phQ9-NRNb8xFzI'
TAB_NAME = 'concept_history'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# 헤더 컬럼 (9개)
HEADERS = [
    'student_id',
    'event_type',
    'timestamp',
    'curriculum',
    'subject',
    'concept_id',
    'score',
    'duration_sec',
    'detail_json'
]

# 프로젝트 루트
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDENTIALS_PATH = os.path.join(PROJECT_ROOT, 'credentials.json')
TOKEN_PATH = os.path.join(PROJECT_ROOT, 'token.json')


def get_credentials():
    """OAuth 인증 처리"""
    creds = None

    # 기존 토큰 로드
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    # 토큰 유효성 검사 및 갱신
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("토큰 만료됨. 갱신 중...")
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"토큰 갱신 실패: {e}")
                print("토큰 삭제 후 재인증 필요")
                if os.path.exists(TOKEN_PATH):
                    os.remove(TOKEN_PATH)
                creds = None

        if not creds:
            if not os.path.exists(CREDENTIALS_PATH):
                print(f"Error: credentials.json이 없습니다: {CREDENTIALS_PATH}")
                print("Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 다운로드하세요.")
                return None

            print("새로운 인증 시작...")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        # 토큰 저장
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())
            print(f"토큰 저장됨: {TOKEN_PATH}")

    return creds


def create_concept_history_sheet():
    """concept_history 탭 생성"""
    creds = get_credentials()
    if not creds:
        return False

    service = build('sheets', 'v4', credentials=creds)

    # 1. 기존 시트 확인
    print(f"\n스프레드시트 확인 중: {SPREADSHEET_ID}")
    try:
        spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        sheets = spreadsheet.get('sheets', [])
        existing_tabs = [s['properties']['title'] for s in sheets]
        print(f"기존 탭: {existing_tabs}")

        if TAB_NAME in existing_tabs:
            print(f"\n'{TAB_NAME}' 탭이 이미 존재합니다.")

            # 헤더 확인
            result = service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f'{TAB_NAME}!A1:I1'
            ).execute()
            current_headers = result.get('values', [[]])[0]

            if current_headers == HEADERS:
                print("헤더가 올바르게 설정되어 있습니다.")
            else:
                print(f"현재 헤더: {current_headers}")
                print(f"예상 헤더: {HEADERS}")
                print("헤더 업데이트 중...")
                service.spreadsheets().values().update(
                    spreadsheetId=SPREADSHEET_ID,
                    range=f'{TAB_NAME}!A1:I1',
                    valueInputOption='RAW',
                    body={'values': [HEADERS]}
                ).execute()
                print("헤더 업데이트 완료!")

            return True
    except Exception as e:
        print(f"스프레드시트 조회 오류: {e}")
        return False

    # 2. 새 탭 생성
    print(f"\n'{TAB_NAME}' 탭 생성 중...")
    try:
        request_body = {
            'requests': [{
                'addSheet': {
                    'properties': {
                        'title': TAB_NAME,
                        'gridProperties': {
                            'rowCount': 1000,
                            'columnCount': 9,
                            'frozenRowCount': 1
                        }
                    }
                }
            }]
        }
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=request_body
        ).execute()
        print(f"'{TAB_NAME}' 탭 생성 완료!")
    except Exception as e:
        print(f"탭 생성 오류: {e}")
        return False

    # 3. 헤더행 추가
    print("헤더행 추가 중...")
    try:
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{TAB_NAME}!A1:I1',
            valueInputOption='RAW',
            body={'values': [HEADERS]}
        ).execute()
        print("헤더행 추가 완료!")
    except Exception as e:
        print(f"헤더 추가 오류: {e}")
        return False

    # 4. 헤더 스타일링 (굵게, 배경색)
    print("헤더 스타일 적용 중...")
    try:
        sheet_id = None
        spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        for sheet in spreadsheet.get('sheets', []):
            if sheet['properties']['title'] == TAB_NAME:
                sheet_id = sheet['properties']['sheetId']
                break

        if sheet_id is not None:
            requests = [{
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9},
                            'textFormat': {'bold': True}
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            }]
            service.spreadsheets().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={'requests': requests}
            ).execute()
            print("헤더 스타일 적용 완료!")
    except Exception as e:
        print(f"스타일 적용 오류 (무시): {e}")

    print(f"\n=== '{TAB_NAME}' 탭 설정 완료 ===")
    print(f"스프레드시트 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
    return True


def insert_test_row():
    """테스트 행 삽입"""
    creds = get_credentials()
    if not creds:
        return False

    service = build('sheets', 'v4', credentials=creds)

    test_row = [
        'TEST_STUDENT',           # student_id
        'content_view',           # event_type
        '2026-04-11T10:00:00Z',   # timestamp
        'us',                     # curriculum
        'math',                   # subject
        'MATH-ALG-001',           # concept_id
        '',                       # score (content_view에는 없음)
        '120',                    # duration_sec
        json.dumps({'test': True})  # detail_json
    ]

    print("\n테스트 행 삽입 중...")
    try:
        service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{TAB_NAME}!A:I',
            valueInputOption='RAW',
            insertDataOption='INSERT_ROWS',
            body={'values': [test_row]}
        ).execute()
        print("테스트 행 삽입 완료!")
        return True
    except Exception as e:
        print(f"테스트 행 삽입 오류: {e}")
        return False


if __name__ == '__main__':
    import sys

    print("=" * 50)
    print("concept_history Google Sheets 탭 생성")
    print("=" * 50)

    success = create_concept_history_sheet()

    if success and '--test' in sys.argv:
        insert_test_row()

    sys.exit(0 if success else 1)

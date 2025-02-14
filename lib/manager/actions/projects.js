// @flow

import {createAction, type ActionType} from 'redux-actions'
import {browserHistory} from 'react-router'

import {createVoidPayloadAction, secureFetch} from '../../common/actions'
import {getConfigProperty} from '../../common/util/config'
import {deploymentsEnabledAndAcessAllowedForProject} from '../../common/util/permissions'
import {fetchProjectDeployments} from './deployments'
import {fetchProjectFeeds} from './feeds'
import {handleJobResponse} from './status'
import {getActiveProject} from '../selectors'
import {
  projectHasAtLeastOneDeployment,
  projectHasAtLeastOneFeedWithAPublishedVersion
} from '../util'
import {setVisibilitySearchText} from './visibilityFilter'

import type {Project} from '../../types'
import type {
  dispatchFn,
  getStateFn,
  FeedSourceTableComparisonColumns,
  FeedSourceTableSortStrategiesWithOrders
} from '../../types/reducers'

// Bulk Project Actions
const receiveProjects = createAction(
  'RECEIVE_PROJECTS',
  (payload: Array<Project>) => payload
)
const requestingProjects = createVoidPayloadAction('REQUESTING_PROJECTS')
// Single Project Actions
const requestingProject = createVoidPayloadAction('REQUESTING_PROJECT')
const requestingSync = createVoidPayloadAction('REQUESTING_SYNC')
const receiveSync = createVoidPayloadAction('RECEIVE_SYNC')
const savingProject = createVoidPayloadAction('SAVING_PROJECT')
export const setFeedSort = createAction(
  'SET_FEED_SORT_TYPE',
  (payload: FeedSourceTableSortStrategiesWithOrders) => payload
)
// Also used in deployments.js (actions)
export const receiveProject = createAction(
  'RECEIVE_PROJECT',
  (payload: ?Project) => payload
)
const settingActiveProject = createAction(
  'SET_ACTIVE_PROJECT',
  (payload: Project) => payload
)
const setFeedSourceTableComparisonColumn = createAction(
  'SET_FEED_SOURCE_TABLE_COMPARISON_COLUMN',
  (payload: FeedSourceTableComparisonColumns) => payload
)
export const setFeedSourceTableFilterCountStrategy = createAction(
  'SET_FEED_SOURCE_TABLE_FILTER_COUNT_STRATEGY',
  (payload: string) => payload
)
const runningFetchFeedsForProject = createVoidPayloadAction('RUNNING_FETCH_FEED_FOR_PROJECT')

export type ProjectActions = ActionType<typeof receiveProjects> |
  ActionType<typeof requestingProjects> |
  ActionType<typeof requestingProject> |
  ActionType<typeof requestingSync> |
  ActionType<typeof receiveSync> |
  ActionType<typeof savingProject> |
  ActionType<typeof receiveProject> |
  ActionType<typeof settingActiveProject> |
  ActionType<typeof runningFetchFeedsForProject>

export function setActiveProject (project: Project) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    return dispatch(fetchProjectFeeds(project.id))
      .then(() => dispatch(settingActiveProject(project)))
  }
}

export function fetchProjects (getActive: ?boolean = false) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(requestingProjects())
    return dispatch(secureFetch('/api/manager/secure/project'))
      .then(response => response.json())
      .then(projects => {
        dispatch(receiveProjects(projects))
        // return active project if requested
        if (getActive) {
          const activeProject = getActiveProject(getState())
          if (activeProject && !activeProject.feedSources) {
            return dispatch(fetchProjectFeeds(activeProject.id))
              .then(() => activeProject)
          }
        }
        return projects
      })
  }
}

export function fetchProjectsWithPublicFeeds () {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(requestingProjects())
    const url = '/api/manager/public/project'
    return dispatch(secureFetch(url))
      .then(response => response.json())
      .then(projects => dispatch(receiveProjects(projects)))
  }
}

export function fetchProject (projectId: string, unsecure: ?boolean) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(requestingProject())
    const apiRoot = unsecure ? 'public' : 'secure'
    const url = `/api/manager/${apiRoot}/project/${projectId}`
    return dispatch(secureFetch(url))
      .then(response => response.json())
      .then(project => {
        dispatch(receiveProject(project))
        return project
      })
  }
}

export function fetchProjectWithFeeds (projectId: string, unsecure: ?boolean) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(requestingProject())
    const apiRoot = unsecure ? 'public' : 'secure'
    const url = `/api/manager/${apiRoot}/project/${projectId}`
    return dispatch(secureFetch(url))
      .then(response => response.json())
      .then(project => {
        dispatch(receiveProject(project))
        if (!unsecure) {
          return dispatch(fetchProjectFeeds(project.id))
        }
      })
      .catch(err => {
        console.warn(err)
        dispatch(receiveProject(null))
      })
  }
}

export function deleteProject (project: Project) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    const url = `/api/manager/secure/project/${project.id}`
    return dispatch(secureFetch(url, 'delete'))
      .then(response => response.json())
      .then(() => browserHistory.push(`/home`))
  }
}

export function updateProject (
  projectId: string,
  changes: {[string]: any},
  fetchFeeds: ?boolean = false
) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(savingProject())
    const url = `/api/manager/secure/project/${projectId}`
    return dispatch(secureFetch(url, 'put', changes))
      .then((res) => {
        if (fetchFeeds) {
          return dispatch(fetchProjectWithFeeds(projectId))
        } else {
          return dispatch(fetchProject(projectId))
        }
      })
  }
}

export function deployPublic (project: Project) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    const url = `/api/manager/secure/project/${project.id}/deployPublic`
    return dispatch(secureFetch(url, 'post'))
      .then((res) => res.json())
      .then(json => {
        return json
      })
  }
}

export function thirdPartySync (projectId: string, type: string) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(requestingSync())
    const url = `/api/manager/secure/project/${projectId}/thirdPartySync/${type}`
    return dispatch(secureFetch(url))
      .then(response => response.json())
      // .catch(err => console.log(err))
      .then(project => {
        dispatch(receiveSync())
        return dispatch(fetchProjectWithFeeds(projectId))
      })
  }
}

export function fetchFeedsForProject (project: Project) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(runningFetchFeedsForProject())
    const url = `/api/manager/secure/project/${project.id}/fetch`
    return dispatch(secureFetch(url, 'post'))
      .then(res => dispatch(handleJobResponse(res, 'Error fetching project feeds')))
  }
}

export function createProject (props: $Shape<Project>) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(savingProject())
    const url = '/api/manager/secure/project'
    let newProjectId
    return dispatch(secureFetch(url, 'post', props))
      .then((res) => res.json())
      .then((json) => {
        newProjectId = json.id
        return dispatch(fetchProjects())
      })
      .then(() => {
        browserHistory.push(`/project/${newProjectId}`)
      })
  }
}

/**
 * Download a merged GTFS file for a Project
 */
export function downloadFeedForProject (project: Project) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    const url = `/api/manager/secure/project/${project.id}/download`
    return dispatch(secureFetch(url))
      .then(res => dispatch(handleJobResponse(res, 'Error merging project feeds')))
  }
}

/**
 * Download a GTFS file for a merged project feed.
 */
export function downloadMergedFeedViaToken (
  project: Project,
  isPublic: boolean
) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    const route = isPublic ? 'public' : 'secure'
    const url = `/api/manager/${route}/project/${project.id}/downloadtoken`
    return dispatch(secureFetch(url))
      .then(response => response.json())
      .then(json => {
        if (getConfigProperty('application.data.use_s3_storage')) {
          // Download object using presigned S3 URL.
          window.location.assign(json.url)
        } else {
          // use token to download feed
          window.location.assign(`/api/manager/downloadprojectfeed/${json.id}`)
        }
      })
  }
}

/**
 * When project viewer component mounts, unconditionally load project with feed
 * sources to ensure that updates to feed sources (e.g., a new feed version) are
 * applied to other project collections (e.g., a deployment that references said
 * feed source).
 */
export function onProjectViewerMount (projectId: string) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    dispatch(setVisibilitySearchText(null))
    return dispatch(fetchProjectWithFeeds(projectId))
      .then(() => {
        // if deployments are enabled, and the user is a project admin, fetch
        // the deployments right away because this data is needed to calculate
        // whether or not the feed source table comparison column should be
        // shown
        const {projects, user} = getState()
        const project = projects.all ? projects.all.find(p => p.id === projectId) : null
        if (deploymentsEnabledAndAcessAllowedForProject(project, user)) {
          return dispatch(fetchProjectDeployments(projectId))
            .then(() => {
              dispatch(calculateFeedSourceTableComparisonColumn(projectId))
            })
        } else {
          return dispatch(calculateFeedSourceTableComparisonColumn(projectId))
        }
      })
  }
}

/**
 * Calculate what comparison column if any should be displayed in the project
 * feed source table
 */
export function calculateFeedSourceTableComparisonColumn (projectId: string) {
  return function (dispatch: dispatchFn, getState: getStateFn) {
    const {projects, user} = getState()
    const {feedSourceTableFilterCountStrategy} = projects.filter
    const project = projects.all
      ? projects.all.find(p => p.id === projectId)
      : null

    if (feedSourceTableFilterCountStrategy === 'PUBLISHED') {
      // this first check is possible because the user must manually set the
      // count strategy after a project is loaded. Therefore, there is
      // gauranteed to be at least one feed source with a published version
      return dispatch(setFeedSourceTableComparisonColumn('PUBLISHED'))
    } else if (
      project &&
        deploymentsEnabledAndAcessAllowedForProject(project, user) &&
        projectHasAtLeastOneDeployment(project)
    ) {
      // deployments are enabled and visible for priveleged user. Show the
      // deployments comparison column if the filter strategy is not set to
      // PUBLISHED
      return dispatch(setFeedSourceTableComparisonColumn('DEPLOYED'))
    } else if (projectHasAtLeastOneFeedWithAPublishedVersion(project)) {
      return dispatch(setFeedSourceTableComparisonColumn('PUBLISHED'))
    } else {
      // deployments not possible, and no published versions, so nothing to
      // compare to
      return dispatch(setFeedSourceTableComparisonColumn(null))
    }
  }
}

// @flow

import Icon from '@conveyal/woonerf/components/icon'
import React, {Component} from 'react'
import { Row, Col, Panel, Label, Glyphicon, ListGroup, ListGroupItem } from 'react-bootstrap'
import { LinkContainer } from 'react-router-bootstrap'

import * as versionsActions from '../../actions/versions'
import {getComponentMessages, isModuleEnabled} from '../../../common/util/config'
import * as snapshotActions from '../../../editor/actions/snapshots'
import FeedVersionReport from './FeedVersionReport'
import ActiveGtfsPlusVersionSummary from '../../../gtfsplus/containers/ActiveGtfsPlusVersionSummary'
import VersionDateLabel from './VersionDateLabel'
import NotesViewer from '../NotesViewer'
import {getTableFatalExceptions} from '../../util/version'
import GtfsValidationViewer from '../validation/GtfsValidationViewer'
import VersionButtonToolbar from './VersionButtonToolbar'

import type {Feed, FeedVersion, Note, Project} from '../../../types'
import type {GtfsState, ManagerUserState} from '../../../types/reducers'

export type Props = {
  deleteDisabled: ?boolean,
  deleteFeedVersion: typeof versionsActions.deleteFeedVersion,
  downloadFeedViaToken: typeof versionsActions.downloadFeedViaToken,
  downloadGtfsPlusFeed: FeedVersion => void,
  editDisabled: ?boolean,
  exportVersionShapes: typeof versionsActions.exportVersionShapes,
  feedSource: Feed,
  feedSource: Feed,
  feedVersionIndex: number,
  fetchGTFSEntities: typeof versionsActions.fetchGTFSEntities,
  fetchValidationErrors: typeof versionsActions.fetchValidationErrors,
  fetchValidationIssueCount: (FeedVersion) => void,
  gtfs: GtfsState,
  hasVersions: boolean,
  isPublic?: boolean,
  listView: boolean,
  loadFeedVersionForEditing: typeof snapshotActions.loadFeedVersionForEditing,
  newNotePosted: $Shape<Note> => void,
  notesRequested: () => void,
  project: ?Project,
  publishFeedVersion: typeof versionsActions.publishFeedVersion,
  renameFeedVersion: typeof versionsActions.renameFeedVersion,
  user: ManagerUserState,
  version: FeedVersion,
  versionSection: ?string,
  versions: Array<FeedVersion>
}

export default class FeedVersionViewer extends Component<Props> {
  messages = getComponentMessages('FeedVersionViewer')

  render () {
    const {
      feedVersionIndex,
      listView,
      newNotePosted,
      notesRequested,
      version,
      versionSection,
      user
    } = this.props

    if (!version) {
      return (
        <p className='text-center lead'>
          {this.messages('noVersionsExist')}
        </p>
      )
    }

    if (listView) {
      // List view of feed versions
      return (
        <Row>
          <Col xs={12} sm={12}>
            <VersionList {...this.props} />
          </Col>
        </Row>
      )
    }
    return (
      <Row>
        <Col xs={12} sm={3}>
          <VersionSectionSelector
            version={version}
            feedVersionIndex={feedVersionIndex}
            versionSection={versionSection} />
        </Col>
        <Col xs={12} sm={9}>
          {!versionSection
            ? <FeedVersionReport {...this.props} />
            : versionSection === 'issues'
              ? <GtfsValidationViewer
                {...this.props}
                validationResult={version.validationResult} />
              : versionSection === 'gtfsplus' && isModuleEnabled('gtfsplus')
                ? <ActiveGtfsPlusVersionSummary
                  version={version} />
                : versionSection === 'comments'
                  ? <NotesViewer
                    type='feed-version'
                    stacked
                    user={user}
                    version={version}
                    notes={version.notes}
                    noteCount={version.noteCount}
                    notesRequested={notesRequested}
                    newNotePosted={newNotePosted} />
                  : null
          }
        </Col>
      </Row>
    )
  }
}

type SelectorProps = {
  feedVersionIndex: number,
  version: FeedVersion,
  versionSection: ?string
}

class VersionSectionSelector extends Component<SelectorProps> {
  _renderIssuesLabel (version) {
    const tableFatalExceptions = getTableFatalExceptions(version)
    const {validationSummary, feedLoadResult} = version
    const hasCriticalError = validationSummary.loadStatus !== 'SUCCESS' ||
      !feedLoadResult || feedLoadResult.fatalException ||
      tableFatalExceptions.length > 0
    const color = hasCriticalError
      ? 'danger'
      : validationSummary.errorCount
        ? 'warning'
        : 'success'
    const text = hasCriticalError
      ? 'critical error'
      : validationSummary.errorCount
    return (
      <Label bsStyle={color}>
        {text}
      </Label>
    )
  }

  render () {
    const { version } = this.props
    return (
      <Panel>
        <ListGroup fill>
          <LinkContainer
            to={`/feed/${version.feedSource.id}/version/${this.props.feedVersionIndex}`}
            active={!this.props.versionSection}>
            <ListGroupItem><Icon type='info-circle' /> Version summary</ListGroupItem>
          </LinkContainer>
          <LinkContainer
            to={`/feed/${version.feedSource.id}/version/${this.props.feedVersionIndex}/issues`}
            active={this.props.versionSection === 'issues'}>
            <ListGroupItem>
              <Icon type='exclamation-triangle' /> Validation issues {this._renderIssuesLabel(version)}
            </ListGroupItem>
          </LinkContainer>
          {isModuleEnabled('gtfsplus')
            ? <LinkContainer
              to={`/feed/${version.feedSource.id}/version/${this.props.feedVersionIndex}/gtfsplus`}
              active={this.props.versionSection === 'gtfsplus'}>
              <ListGroupItem>
                <Icon type='plus' /> GTFS+ for this version
              </ListGroupItem>
            </LinkContainer>
            : null
          }
          <LinkContainer
            to={`/feed/${version.feedSource.id}/version/${this.props.feedVersionIndex}/comments`}
            active={this.props.versionSection === 'comments'}>
            <ListGroupItem>
              <Glyphicon glyph='comment' /> Version comments{' '}
              <Label>{version.noteCount}</Label>
            </ListGroupItem>
          </LinkContainer>
        </ListGroup>
      </Panel>
    )
  }
}

export type ListProps = Props

class VersionList extends Component<ListProps> {
  render () {
    return <Panel header={<h3>List of feed versions</h3>}>
      <ListGroup fill>
        {this.props.versions
          ? this.props.versions.map(v => {
            return (
              <ListGroupItem key={v.id}>
                {v.name}
                {' '}
                <small>
                  <VersionDateLabel version={v} />
                </small>
                <VersionButtonToolbar
                  version={v}
                  size='xsmall'
                  {...this.props} />
              </ListGroupItem>
            )
          })
          : <ListGroupItem>
            No versions
          </ListGroupItem>
        }
      </ListGroup>
    </Panel>
  }
}

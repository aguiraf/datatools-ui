// @flow

import Icon from '@conveyal/woonerf/components/icon'
import objectPath from 'object-path'
import React, {Component} from 'react'
import {Row, Col, Button, Panel, Glyphicon, Radio, FormGroup, ControlLabel, FormControl} from 'react-bootstrap'
import update from 'react-addons-update'
import {shallowEqual} from 'react-pure-render'
import {withRouter} from 'react-router'

import {getComponentMessages} from '../../common/util/config'
import CollapsiblePanel from './CollapsiblePanel'
import {FIELDS, SERVER_FIELDS, UPDATER_FIELDS} from '../util/deployment'

import {updateProject} from '../actions/projects'
import type {BuildConfig, Project, RouterConfig} from '../../types'

type Props = {
  editDisabled: boolean,
  project: Project,
  updateProject: typeof updateProject
}

type State = {
  buildConfig: BuildConfig,
  otpServers: Array<any>,
  routerConfig: RouterConfig,
  useCustomOsmBounds?: boolean
}

class DeploymentSettings extends Component<Props, State> {
  messages = getComponentMessages('DeploymentSettings')

  componentWillMount () {
    this.setState({
      buildConfig: objectPath.get(this.props, 'project.buildConfig') || {},
      routerConfig: objectPath.get(this.props, 'project.routerConfig') || {},
      otpServers: objectPath.get(this.props, 'project.otpServers') || []
    })
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.project.lastUpdated !== this.props.project.lastUpdated) {
      // Reset state using project data if it is updated.
      this.setState({
        buildConfig: objectPath.get(nextProps, 'project.buildConfig') || {},
        routerConfig: objectPath.get(nextProps, 'project.routerConfig') || {},
        otpServers: objectPath.get(nextProps, 'project.otpServers') || []
      })
    }
  }

  componentDidMount () {
    // FIXME: This is broken. Check for edits does not always return correct value.
    // this.props.router.setRouteLeaveHook(this.props.route, () => {
    //   if (!this._noEdits()) {
    //     return 'You have unsaved information, are you sure you want to leave this page?'
    //   }
    // })
  }

  _clearBuildConfig = () => {
    this.props.updateProject(this.props.project.id, {buildConfig: {}})
  }

  _clearRouterConfig = () => {
    this.props.updateProject(this.props.project.id, {routerConfig: {}})
  }

  _getOnChange = (evt, index = null) => {
    let item = FIELDS.find(f => f.name === evt.target.name)
    if (!item) item = UPDATER_FIELDS.find(f => f.name === evt.target.name)
    if (!item) item = SERVER_FIELDS.find(f => f.name === evt.target.name)
    if (item) {
      const stateUpdate = {}
      item.effects && item.effects.forEach(e => {
        objectPath.set(stateUpdate, `${e.key}.$set`, e.value)
      })
      switch (item.type) {
        case 'checkbox':
          return this._onChangeCheckbox(evt, stateUpdate, index)
        case 'select-bool':
          return this._onSelectBool(evt, stateUpdate, index)
        case 'number':
          return this._onChangeNumber(evt, stateUpdate, index)
        default:
          // check for split property, which indicates that comma-separated list should be split into array
          if (item.split) {
            return this._onChangeSplit(evt, stateUpdate, index)
          } else {
            return this._onChange(evt, stateUpdate, index)
          }
      }
    } else {
      console.warn('no onChange function available')
    }
  }

  _onChangeCheckbox = (evt, stateUpdate = {}, index = null) => {
    const name = index !== null ? evt.target.name.replace('$index', `${index}`) : evt.target.name
    objectPath.set(stateUpdate, `${name}.$set`, evt.target.checked)
    this.setState(update(this.state, stateUpdate))
  }

  _onChangeSplit = (evt, stateUpdate = {}, index = null) => {
    const name = index !== null ? evt.target.name.replace('$index', `${index}`) : evt.target.name
    objectPath.set(stateUpdate, `${name}.$set`, evt.target.value.split(','))
    this.setState(update(this.state, stateUpdate))
  }

  _onAddServer = () => {
    const stateUpdate = { otpServers: { $push: [{name: '', publicUrl: '', internalUrl: [], admin: false}] } }
    this.setState(update(this.state, stateUpdate))
  }

  _onAddUpdater = () => {
    const stateUpdate = {}
    objectPath.set(stateUpdate,
      `routerConfig.updaters.$${this.state.routerConfig.updaters ? 'push' : 'set'}`,
      [{type: '', url: '', frequencySec: 30, sourceType: '', defaultAgencyId: ''}]
    )
    this.setState(update(this.state, stateUpdate))
  }

  _onRemoveUpdater = (index) => {
    const stateUpdate = {}
    objectPath.set(stateUpdate, `routerConfig.updaters.$splice`, [[index, 1]])
    this.setState(update(this.state, stateUpdate))
  }

  _onRemoveServer = (index) => {
    const stateUpdate = { otpServers: { $splice: [[index, 1]] } }
    this.setState(update(this.state, stateUpdate))
  }

  _onChange = (evt, stateUpdate = {}, index = null) => {
    const name = index !== null ? evt.target.name.replace('$index', `${index}`) : evt.target.name
    // If value is empty string or undefined, set to null in settings object.
    // Otherwise, certain fields (such as 'fares') would cause issues with OTP.
    objectPath.set(stateUpdate, `${name}.$set`, evt.target.value || null)
    this.setState(update(this.state, stateUpdate))
  }

  _onChangeNumber = (evt, stateUpdate = {}, index = null) => {
    const name = index !== null ? evt.target.name.replace('$index', `${index}`) : evt.target.name
    objectPath.set(stateUpdate, `${name}.$set`, +evt.target.value)
    this.setState(update(this.state, stateUpdate))
  }

  _onSelectBool = (evt, stateUpdate = {}, index = null) => {
    const name = index !== null ? evt.target.name.replace('$index', `${index}`) : evt.target.name
    objectPath.set(stateUpdate, `${name}.$set`, (evt.target.value === 'true'))
    this.setState(update(this.state, stateUpdate))
  }

  _getFields = (fields, state, filter) => {
    return fields
      .filter(f => filter ? f.name.startsWith(filter) : f)
      .map((f, index) => {
        const {effects, ...fieldProps} = f
        // check for conditional render, e.g. elevationBucket is dependent on fetchElevationUS
        if (f.condition) {
          const {key, value} = f.condition
          const val = objectPath.get(state, `${key}`)
          if (val !== value) return null
        }
        const value = objectPath.get(state, `${f.name}`)
        return (
          <Col key={`${index}`} xs={f.width || 6}>
            <FormGroup>
              <ControlLabel>{this.messages(f.name)}</ControlLabel>
              <FormControl
                {...fieldProps}
                value={value === null ? '' : value}
                onChange={this._getOnChange}
                children={f.children
                  ? f.children.map((o, i) => (
                    <option key={i} {...o} />
                  ))
                  : undefined
                } />
            </FormGroup>
          </Col>
        )
      })
  }

  _onSave = (evt) => this.props.updateProject(this.props.project.id, this.state)

  _onToggleCustomBounds = (evt) => {
    const stateUpdate = { useCustomOsmBounds: { $set: (evt.target.value === 'true') } }
    this.setState(update(this.state, stateUpdate))
  }

  _onChangeBounds = (evt) => {
    const bBox = evt.target.value.split(',')
    if (bBox.length === 4) {
      const stateUpdate = { $merge: { osmWest: bBox[0], osmSouth: bBox[1], osmEast: bBox[2], osmNorth: bBox[3] } }
      this.setState(update(this.state, stateUpdate))
    }
  }

  /**
   * Determine if deployment settings have been modified by checking that every
   * item in the state matches the original object found in the project object.
   */
  _noEdits = () => Object.keys(this.state)
    // $FlowFixMe it's fine if key doesn't exist in this.props.project
    .every(key => shallowEqual(this.state[key], this.props.project[key]))

  render () {
    const updaters = objectPath.get(this.state, 'routerConfig.updaters') || []
    const {otpServers} = this.state
    const {project, editDisabled} = this.props
    return (
      <div key={project.lastUpdated} className='deployment-settings-panel'>
        {/* Build config settings */}
        <Panel header={
          <h4>
            <Button
              bsSize='xsmall'
              onClick={this._clearBuildConfig}
              className='pull-right'>Clear
            </Button>
            <Icon type='cog' />{' '}
            {this.messages('buildConfig.title')}
          </h4>
        }>
          {this._getFields(FIELDS, this.state, 'buildConfig')}
        </Panel>
        {/* Router config settings */}
        <Panel header={
          <h4>
            <Button
              bsSize='xsmall'
              onClick={this._clearRouterConfig}
              className='pull-right'>Clear
            </Button>
            <Icon type='cog' />{' '}
            {this.messages('routerConfig.title')}
          </h4>
        }>
          {this._getFields(FIELDS, this.state, 'routerConfig')}
        </Panel>
        {/* Real-time Updaters (technically still a part of router config) */}
        <Panel header={
          <h4>
            <Button
              className='pull-right'
              bsStyle='success'
              bsSize='xsmall'
              onClick={this._onAddUpdater}>
              <Glyphicon glyph='plus' />{' '}
              {this.messages('routerConfig.updaters.new')}
            </Button>
            <Icon type='bolt' />{' '}
            {this.messages('routerConfig.updaters.title')}
          </h4>
        }>
          {updaters.map((u, i) => (
            <CollapsiblePanel
              key={i}
              index={i}
              fields={UPDATER_FIELDS}
              data={u}
              defaultExpanded={!u.type}
              onRemove={this._onRemoveUpdater}
              onChange={this._getOnChange}
              title={u.type
                ? <span>
                  {u.type}{'  '}
                  <small>{u.url}</small>
                </span>
                : `[${this.messages('routerConfig.updaters.placeholder')}]`
              }
            />
          ))}
        </Panel>
        {/* OTP server settings */}
        <Panel header={
          <h4>
            <Button
              bsSize='xsmall'
              bsStyle='success'
              className='pull-right'
              data-test-id='add-server-button'
              onClick={this._onAddServer}>
              <Glyphicon glyph='plus' /> {this.messages('otpServers.new')}
            </Button>
            <Icon type='server' /> {this.messages('otpServers.title')}
          </h4>
        }>
          <div>
            {otpServers && otpServers.map((server, i) => (
              <CollapsiblePanel
                key={i}
                index={i}
                fields={SERVER_FIELDS}
                defaultExpanded={!server.name}
                title={server.name
                  ? <span>
                    {server.name}{'  '}
                    <small>{server.publicUrl}</small>
                  </span>
                  : `[${this.messages('otpServers.serverPlaceholder')}]`
                }
                data={server}
                onRemove={this._onRemoveServer}
                onChange={this._getOnChange} />
            ))}
          </div>
        </Panel>
        {/* OSM extract settings */}
        <Panel header={<h4><Icon type='globe' /> {this.messages('osm.title')}</h4>}>
          <FormGroup
            onChange={this._onToggleCustomBounds}>
            <Radio
              name='osm-extract'
              checked={typeof this.state.useCustomOsmBounds !== 'undefined' ? !this.state.useCustomOsmBounds : !project.useCustomOsmBounds}
              value={false}>
              {this.messages('osm.gtfs')}
            </Radio>
            <Radio
              name='osm-extract'
              checked={typeof this.state.useCustomOsmBounds !== 'undefined' ? this.state.useCustomOsmBounds : project.useCustomOsmBounds}
              value>
              {this.messages('osm.custom')}
            </Radio>
          </FormGroup>
          {project.useCustomOsmBounds || this.state.useCustomOsmBounds
            ? <FormGroup>
              <ControlLabel>{(<span><Glyphicon glyph='fullscreen' /> {this.messages('osm.bounds')}</span>)}</ControlLabel>
              <FormControl
                type='text'
                defaultValue={project.bounds
                  ? `${project.bounds.west},${project.bounds.south},${project.bounds.east},${project.bounds.north}`
                  : ''
                }
                placeholder='-88.45,33.22,-87.12,34.89'
                name='osmBounds'
                onChange={this._onChangeBounds} />
            </FormGroup>
            : null
          }
        </Panel>
        <Row>
          <Col md={12}>
            {/* Save button */}
            <Button
              bsStyle='primary'
              data-test-id='save-settings-button'
              disabled={editDisabled || this._noEdits()}
              onClick={this._onSave}>
              {this.messages('save')}
            </Button>
          </Col>
        </Row>
      </div>
    )
  }
}

export default withRouter(DeploymentSettings)

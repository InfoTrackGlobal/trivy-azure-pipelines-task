import { Card } from "azure-devops-ui/Card";
import { Checkbox } from "azure-devops-ui/Checkbox";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { DropdownFilterBarItem } from "azure-devops-ui/Dropdown";
import { FilterBar } from "azure-devops-ui/FilterBar";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Observer } from "azure-devops-ui/Observer";
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs";
import { KeywordFilterBarItem } from "azure-devops-ui/TextFilterBarItem";
import {
    DropdownSelection
} from "azure-devops-ui/Utilities/DropdownSelection";
import { FILTER_CHANGE_EVENT, Filter, FilterOperatorType } from "azure-devops-ui/Utilities/Filter";
import * as React from 'react';
import { FilesystemReport } from "./FilesystemReport";
import { ImageReport } from "./ImageReport";
import './ReportsPane.css';
import {
    ArtifactType,
    AssuranceReport,
    Report,
    Summary,
    SummaryEntry,
    countReportIssues,
    getReportTitle
} from './trivy';
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";

interface ReportsPaneProps {
    summary: Summary
    getReports: (name: string) => Promise<Report[] | undefined>
    assuranceReports: AssuranceReport[]
}

interface ReportsPaneState {
    selectedTabId: string,
    selectedReportTabId: string,
    reports?: Report[]
    isLoading: boolean
}

interface FilterState {
    repository: string
    owner: string
    withIssues: boolean
}

export class ReportsPane extends React.Component<ReportsPaneProps, ReportsPaneState> {
    public props: ReportsPaneProps
    public state: ReportsPaneState

    private filter: Filter;
    private currentState = new ObservableValue({} as FilterState);
    private selectionOwner = new DropdownSelection();
    private onlyWithIssues = new ObservableValue<boolean>(true);

    constructor(props: ReportsPaneProps) {
        super(props)

        this.filter = new Filter();
        this.filter.setFilterItemState("owner", {
            value: "",
            operator: FilterOperatorType.and
        })
        this.filter.setFilterItemState("withIssues", {
            value: false,
            operator: FilterOperatorType.and
        })
        this.filter.subscribe(() => {
            const owner = this.filter.getState()["owner"]
            const repository = this.filter.getState()["repository"]
            const withIssues = this.filter.getState()["withIssues"]

            this.currentState.value = { repository: repository?.value, owner: owner?.value[0], withIssues: withIssues?.value }
        }, FILTER_CHANGE_EVENT)

        this.state = {
            selectedTabId: "",
            selectedReportTabId: "",
            isLoading: true,
        }
    }

    private onSelectedTabChanged = async (newTabId: string) => {
        this.setState({ selectedTabId: newTabId, isLoading: true })
        const reports = await this.props.getReports(newTabId)
        this.setState({ reports, isLoading: false})
    };

    private onSelectedReportTabChanged = (newTabId: string) => {
        this.setState({ selectedReportTabId: newTabId });
    };

    private getReport(): Report {
        if (this.state.reports && this.state.reports?.length > 0) {
            return this.state.reports[parseInt(this.state.selectedReportTabId)]
        }

        return undefined
    }

    private getAssuranceReport(): AssuranceReport | undefined {
        if (this.state.reports === null) {
            return undefined
        }
        let assuranceReport: AssuranceReport | undefined = undefined
        this.props.assuranceReports.forEach(match => {
            if (this.getReport()?.ArtifactType == match.Report.ArtifactType && this.getReport()?.ArtifactName == match.Report.ArtifactName) {
                assuranceReport = match
            }
        })
        return assuranceReport
    }

    componentDidUpdate(_prevProps: Readonly<ReportsPaneProps>, prevState: Readonly<ReportsPaneState>): void {
        if (this.props.summary.results.length > 0 && prevState.selectedTabId === "") {
            const worstRepository = this.props.summary.results.reduce(
                (previous, current) => previous.secretsCount < current.secretsCount ? current : previous).repository

            this.props.getReports(worstRepository).then(reports => {
                this.setState({
                    reports: reports,
                    selectedTabId: worstRepository,
                    selectedReportTabId: "0",
                    isLoading: false
                })
            })
        }
    }

    render() {
        const stats = [
            {
                name: "Total Scans",
                value: this.props.summary.results?.length ?? 0
            },
            {
                name: "Total Issues",
                value: this.props.summary.results?.reduce((previous, current) => previous += current.secretsCount ?? 0 + current.misconfigurationCount ?? 0 + current.vulnerabilityCount ?? 0, 0)
            },
            {
                name: "Vulnerabilities",
                value: this.props.summary.results?.reduce((previous, current) => previous += current.vulnerabilityCount ?? 0, 0)
            },
            {
                name: "Misconfigurations",
                value: this.props.summary.results?.reduce((previous, current) => previous += current.misconfigurationCount ?? 0, 0)
            },
            {
                name: "Secrets",
                value: this.props.summary.results?.reduce((previous, current) => previous += current.secretsCount ?? 0, 0)
            }
        ]

        return (
            <div>
                <div className="flex-column">
                    {
                        this.props.summary.results?.length === 0 ?
                            <MessageCard
                                className="flex-self-stretch"
                                severity={MessageCardSeverity.Info}
                            >
                                No reports found for this build. Add Trivy to your pipeline configuration or check the build
                                logs for more information.
                            </MessageCard> :
                            <div className="flex-grow">
                                {
                                    this.props.summary.results?.length > 1 &&
                                    <>
                                        <div className="flex-row" style={{ paddingBottom: 40 }}>
                                            <Card className="flex-grow">
                                                <div className="flex-row" style={{ flexWrap: "wrap" }}>
                                                    {stats.map((items, index) => (
                                                        <div className="flex-column" style={{ minWidth: "120px" }} key={index}>
                                                            <div className="body-m secondary-text">{items.name}</div>
                                                            <div className="body-m primary-text">{items.value}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        </div>
                                        <div className="flex-row" style={{ paddingBottom: 20 }}>
                                            <div className="flex-grow">
                                                <FilterBar filter={this.filter} onDismissClicked={() => this.onlyWithIssues.value = false}>
                                                    <KeywordFilterBarItem filterItemKey="repository" placeholder="Repository name" />

                                                    <Checkbox
                                                        onChange={(_, checked) => {
                                                            this.onlyWithIssues.value = checked
                                                            this.filter.setFilterItemState("withIssues", {
                                                                value: checked,
                                                                operator: FilterOperatorType.and
                                                            })
                                                        }}
                                                        checked={this.onlyWithIssues}
                                                        label="With Issues"
                                                        className="faded-color"
                                                    />
                                                    <DropdownFilterBarItem
                                                        filterItemKey="owner"
                                                        filter={this.filter}
                                                        items={this.props.summary.results
                                                            .reduce((acc: string[], current) => {
                                                                if (!acc.includes(current.owner) && current.owner !== "") {
                                                                    acc.push(current.owner)
                                                                }
                                                                return acc
                                                            }, [])
                                                            .map(owner => ({
                                                                id: owner,
                                                                key: owner,
                                                                text: owner
                                                            }))
                                                        }
                                                        selection={this.selectionOwner}
                                                        placeholder="Owner"
                                                    />
                                                </FilterBar>
                                            </div>
                                        </div>
                                        <div className="flex-row" style={{ overflow: "auto" }}>
                                            <Observer currentState={this.currentState}>
                                                {(props: { currentState: FilterState }) => (
                                                    <TabBar
                                                        onSelectedTabChanged={this.onSelectedTabChanged}
                                                        selectedTabId={this.state.selectedTabId}
                                                        tabSize={TabSize.Tall}
                                                    >
                                                        {
                                                            this.props.summary.results
                                                                ?.filter((entry: SummaryEntry) => (
                                                                    (props.currentState.repository?.length > 0 ? entry.repository.toLowerCase().includes(props.currentState.repository?.toLowerCase() ?? "") : true) &&
                                                                    (props.currentState.owner?.length > 0 ? entry.owner.toLowerCase() === props.currentState.owner.toLowerCase() : true) &&
                                                                    (props.currentState.withIssues ? entry.secretsCount + entry.misconfigurationCount > 0 : true)
                                                                ))
                                                                ?.sort((a, b) => a.secretsCount + a.misconfigurationCount < b.secretsCount + b.misconfigurationCount ? 1 : -1)
                                                                ?.map((entry: SummaryEntry, index: number) => (
                                                                    <Tab
                                                                        key={index}
                                                                        id={`${entry.repository}`}
                                                                        name={`${entry.repository}`}
                                                                        badgeCount={entry.secretsCount + entry.misconfigurationCount}
                                                                    />
                                                                ))
                                                        }
                                                    </TabBar>
                                                )}
                                            </Observer>
                                        </div>
                                    </>
                                }
                                {
                                    this.state.reports && this.state.reports.length > 1 &&
                                        <div className="flex-row">
                                            <TabBar
                                                onSelectedTabChanged={this.onSelectedReportTabChanged}
                                                selectedTabId={this.state.selectedReportTabId}
                                                tabSize={TabSize.Tall}
                                            >
                                                {
                                                    this.state.reports?.map(function (report: Report, index: number) {
                                                        return (
                                                            <Tab
                                                                key={index}
                                                                id={index + ""}
                                                                name={getReportTitle(report)}
                                                                badgeCount={countReportIssues(report)}
                                                            />
                                                        )
                                                    })
                                                }
                                                </TabBar>
                                        </div>
                                }
                                <div className="flex-grow">
                                    <div className="tab-content">
                                        {
                                            this.state.reports && !this.state.isLoading ?
                                                this.getReport()?.ArtifactType == ArtifactType.Image ?
                                                    <ImageReport report={this.getReport()} assurance={this.getAssuranceReport()} />
                                                    :
                                                    <FilesystemReport report={this.getReport()} assurance={this.getAssuranceReport()} />
                                                :
                                                <div className="flex-center" style={{paddingTop: "100px"}}>
                                                    <Spinner label={"Loading..."} size={SpinnerSize.large}/>
                                                </div>
                                        }
                                    </div>
                                </div>
                            </div >
                    }
                </div>
            </div>
        )
    }
}

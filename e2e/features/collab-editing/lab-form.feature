Feature: Collaborative lab-form editing
  Lab staff edit an experiment's lab form together in the staff workspace
  (/internal/experiment/{contextId}). The form is a live, multi-staff editor —
  backed by the real SSE + POST + Redis transport — but only while the ticket is
  EXPERIMENTING. Edits autosave to experiment-manager; earlier stages render the
  form read-only behind a "Start experiment" gate.

  # NOTE: collaborative editing uses an in-memory Redis mock (E2E_REDIS_MOCK=1)
  # wired by the acceptance harness — no external Redis required.

  Background:
    Given the following users exist:
      | name      | email          | password    | role  |
      | Sam Staff | sam@acme.test  | password123 | admin |
    And I am signed in as "sam@acme.test" with password "password123"

  Scenario: Editing the lab form autosaves while the experiment is in progress
    Given an experiment with ticket status "EXPERIMENTING"
    When I open the experiment workspace
    And I enter "12.5 mg/L measured" in the lab form
    Then the experiment is autosaved with "12.5 mg/L measured"
    When I reopen the experiment workspace
    Then the lab form shows "12.5 mg/L measured"

  Scenario: The lab form is read-only until the experiment is started
    Given an experiment with ticket status "PENDING"
    When I open the experiment workspace
    Then I should see the start-experiment gate
    And the lab form is read-only

  Scenario: A second technician sees presence, soft locks, and live edits
    Given a second technician exists with email "tara@acme.test" and password "password123"
    And an experiment with ticket status "EXPERIMENTING"
    When I open the experiment workspace
    And a second technician opens the experiment as "tara@acme.test" with password "password123"
    Then the second technician sees another editor present
    When I focus the lab form
    Then the second technician sees the lab field locked
    When I type "live readout 42" in the lab form
    Then the second technician sees "live readout 42" in the lab field

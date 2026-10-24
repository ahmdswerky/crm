--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id bigint NOT NULL,
    invoicable_type character varying(120) NOT NULL,
    invoicable_id bigint NOT NULL,
    type character varying(80) NOT NULL,
    value numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;

--
-- Name: payment_event_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_event_outbox (
    event_id uuid NOT NULL,
    command_message_id uuid NOT NULL,
    correlation_id uuid NOT NULL,
    type character varying(120) NOT NULL,
    version smallint NOT NULL,
    source character varying(120) NOT NULL,
    occurred_at timestamp without time zone NOT NULL,
    payload jsonb NOT NULL,
    published_at timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    claimed_at timestamp without time zone,
    claim_token uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: payment_job_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_job_receipts (
    message_id uuid NOT NULL,
    correlation_id uuid NOT NULL,
    command_type character varying(120) NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb NOT NULL,
    result jsonb,
    failure_code character varying(120),
    failure_message character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);

--
-- Name: invoices PK_668cef7c22a427fd822cc1be3ce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY (id);

--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);

--
-- Name: payment_job_receipts PK_8dbd603f499051587bdb233cdce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_job_receipts
    ADD CONSTRAINT "PK_8dbd603f499051587bdb233cdce" PRIMARY KEY (message_id);

--
-- Name: payment_event_outbox PK_c4f9f835b3736e231211dcba643; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_event_outbox
    ADD CONSTRAINT "PK_c4f9f835b3736e231211dcba643" PRIMARY KEY (event_id);

--
-- Name: payment_event_outbox UQ_648c371323054b583a1c71cda58; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_event_outbox
    ADD CONSTRAINT "UQ_648c371323054b583a1c71cda58" UNIQUE (command_message_id);

--
-- Name: IDX_33c00fe490da5cbf42e8516631; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_33c00fe490da5cbf42e8516631" ON public.payment_event_outbox USING btree (correlation_id);

--
-- Name: IDX_3fe3e1a8d63b57d144a7fb9a75; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3fe3e1a8d63b57d144a7fb9a75" ON public.payment_job_receipts USING btree (correlation_id);

--
-- Name: IDX_c3810c87bb4ecc8ea8f3f28fde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c3810c87bb4ecc8ea8f3f28fde" ON public.payment_event_outbox USING btree (published_at, claimed_at);

--
-- PostgreSQL database dump complete
--
